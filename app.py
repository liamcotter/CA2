"""
Add in organised login/register/landing page structure
add leaderboard DB
set up DB

app pw must not show
"""


from flask import Flask, render_template, url_for, redirect, session, g, request, abort
from flask_session import Session
from database import get_db, close_db
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from forms import RegistrationForm, LoginForm
import re
import smtplib, ssl
from random import choice
from string import ascii_letters, digits    
from pw import pw
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)
app.config["SECRET_KEY"] = "Octane Odyssey".encode('utf8')
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_PERMANENT"] = False
app.teardown_appcontext(close_db)
Session(app)

title = "Octane Odyssey"

class Player:
    def __init__(self, rank, username, score):
        self.rank = rank
        self.username = username
        self.score = score

def verify(email : str, link : str, username : str) -> bool:
    # https://realpython.com/python-send-email/
    try:
        link = f"http://cs1.ucc.ie/~lyc1/cgi-bin/ca1/ca2_continuation/run.py/verification/{link}"
        port = 465  # For SSL
        password = pw
        sender_email = "noreply.webdevlyc1@gmail.com"
        receiver_email = email
        message = MIMEMultipart("alternative")
        message["Subject"] = "Email Verification"
        message["From"] = sender_email
        message["To"] = receiver_email
        txt = f"""\
        Please follow this link to verify your email address:
        {link}  
        """
        html = f"""\
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Email Verification</title>
            <style>
            * {{
            margin-left: 0;
            margin-right: 0;
            }}
            div, body {{
                font-family: Arial, sans-serif;
                font-size: 16px;
                color: #333;
                margin: 0 auto;
                background: #ffa200;
            }}
            p, a{{
                text-align: center;
            }}
            p {{
                margin-bottom: 20px;
            }}
            a {{
                display: inline-block;
                padding: 10px 20px;
                background-color: #4CAF50;
                color: #fff;
                text-decoration: none;
                border-radius: 4px;
            }}
            figure {{
                text-align: center;
                background: black;
            }}
            a:hover {{
                background-color: #3E8E41;
            }}
            #end {{
            padding-bottom: 40px;
            }}
            </style>
        </head>
        <body>
            <div>
                <figure>
                    <img src="https://cs1.ucc.ie/~lyc1/cgi-bin/ca2/static/email_logo.png" height="300" alt="Octane Odyssey logo">
                </figure>
                <p>Hello {username},</p>
                <p>Please follow this link to verify your email address:</p>
                <p id="end"><a href="{link}">Verify</a><p>
            </div>
        </body>
        </html>

        """
        part1 = MIMEText(txt, "plain")
        part2 = MIMEText(html, "html")
        message.attach(part1)
        message.attach(part2)
        # Create a secure SSL context
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", port, context=context) as server:
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message.as_string())
        return True
    except:
        return False



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

@app.route("/home")
@login_required
def home():
    db = get_db()
    leaderboard = []
    scores = db.execute("""SELECT username, score FROM scores ORDER BY score DESC LIMIT 10;""").fetchall()
    for rank, data in enumerate(scores):
        player = Player(rank+1, data["username"], data["score"])
        leaderboard.append(player)
    return render_template("home.html", leaderboard=leaderboard)


@app.route("/game")
@login_required
def game():
    return render_template("game.html")

@app.route("/verification/<token>")
def verification(token):
    db = get_db()
    valid = db.execute("""SELECT username FROM verify WHERE token = ?;""", (token,)).fetchone()
    if valid is not None:
        db.execute("""UPDATE users SET verified = 1 WHERE username = ?;""", (valid["username"],))
        db.execute("""DELETE FROM verify WHERE token = ?;""", (token,))
        db.commit()
        return redirect(url_for('login'))
    else:
        return abort(404)

@app.route("/score", methods=["GET","POST"])
def score():
    score = float(request.form.get("score")) # safer
    score = int(round(score, 0))
    username = g.user
    db = get_db()
    db.execute("""INSERT INTO scores (username, score) VALUES (?, ?);""", (username, score))
    db.commit()
    return "Success"


@app.route("/leaderboard_update")
def leaderboard_update():
    db = get_db()
    leaderboard = []
    scores = db.execute("""SELECT username, score FROM scores ORDER BY score DESC LIMIT 10;""").fetchall()
    for rank, data in enumerate(scores):
        player = Player(rank+1, data["username"], data["score"])
        leaderboard.append(player)
    return render_template("leaderboard_update.html", leaderboard=leaderboard)


@app.route("/privacy")
def privacy():
    return render_template("privacy.html")

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
        elif possible_clashing_user["verified"] == 0:
            form.username.errors.append("Please verify your email address")
        else:
            session.clear()
            session["username"] = username
            return redirect(url_for('home'))
    return render_template("login.html", form=form)

@app.route("/logout")
@login_required
def logout():
	session.clear()
	return redirect(url_for('no_log_in'))

@app.route("/register", methods=["GET","POST"])
def register():
    form = RegistrationForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        email = form.email.data
        if "+" in email: # no workaround with gmail to use multiple email addresses that point to one inbox. However, I will not check for duplicate emails as I don't want to store them.
            email = email.replace("@", "+@")
            email = email.split("+")[0] + email.split("+")[-1]
        valid = re.match(r'^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email)
        db = get_db()
        clashing_user = db.execute("""SELECT * FROM users WHERE username = ?;""", (username,) ).fetchone()
        if clashing_user:
            form.username.errors.append("Username is taken.")
        elif not valid:
            form.email.errors.append("Invalid email address")
        else:
            db.execute("""INSERT INTO users (username, password, verified) VALUES (?, ?, ?);""", (username, generate_password_hash(password), 0))
            db.commit()
            token = ''.join(choice(ascii_letters + digits) for i in range(30)).lower()
            email_sent = verify(email, token, username)
            db.execute("""INSERT INTO verify (username, token) VALUES (?, ?);""", (username, token))
            db.commit()
            if email_sent:
                return render_template("verification.html")
            else:
                return render_template("email_fail.html")
    return render_template("register.html", form=form)

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def page_not_found(e):
    return render_template('500.html'), 500