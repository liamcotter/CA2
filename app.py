"""
Add in organised login/register/landing page structure
add leaderboard DB
set up DB
"""


from flask import Flask, render_template, url_for, redirect, session, g, request, abort
from flask_session import Session
from database import get_db, close_db
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from forms import RegistrationForm, LoginForm


app = Flask(__name__)
app.config["SECRET_KEY"] = "Octane Odyssey".encode('utf8')
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_PERMANENT"] = False
app.teardown_appcontext(close_db)
Session(app)

title = "Octane Odyssey"

# decorators
@app.before_request
def logged_in_user():
    g.user = session.get("username", None)

def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if g.user is None:
            return redirect(url_for('login')) # always return to "home" page after logging in. Not to game.
        return view(*args, **kwargs)
    return wrapped_view

def admin_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if g.user != "admin":
            return redirect(url_for('login')) # same here
        return view(*args, **kwargs)
    return wrapped_view

# game routes
@app.route("/")
def no_log_in():
    if g.user:
        return redirect(url_for('home'))
    else:
        return render_template("landing_page.html")

# general routes

@app.route("/login", methods=["GET","POST"])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        db = get_db()
        possible_clashing_user = db.execute("""SELECT * FROM users WHERE
									username = ?;""", (username,) ).fetchone()
        if possible_clashing_user is None or not check_password_hash(possible_clashing_user['password'], password):
            form.password.errors.append("Incorrect username or password")
        else:
            session.clear()
            session["username"] = username
            return redirect(url_for('/home'))
    return render_template("login.html", form=form)

@app.route("/logout")
@login_required
def logout():
	session.clear()
	return redirect(url_for('home'))

@app.route("/register", methods=["GET","POST"])
def register():
    form = RegistrationForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        db = get_db()
        clashing_user = db.execute("""SELECT * FROM users WHERE username = ?;""", (username,) ).fetchone()
        if clashing_user:
            form.username.errors.append("Username is taken.")
        else:
            db.execute("""INSERT INTO users (username, password) VALUES (?, ?);""", (username, generate_password_hash(password)))
            db.commit()
            return redirect(url_for('login'))
    return render_template("register.html", form=form, title=title)

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html', title=title), 404

@app.errorhandler(500)
def page_not_found(e):
    return render_template('500.html', title=title), 500