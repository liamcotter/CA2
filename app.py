from flask import Flask, render_template, url_for, redirect, session, g, request, abort
from flask_session import Session
from database import get_db, close_db

app = Flask(__name__)
app.config["SECRET_KEY"] = "efojiwsdlo&^diqwe34 3£93irefj9h-_f".encode('utf8')
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_PERMANENT"] = False
app.teardown_appcontext(close_db)
Session(app)

@app.route("/")
def home():
    return render_template("game.html")
