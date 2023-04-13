from flask_wtf import FlaskForm
from wtforms import SubmitField, StringField, PasswordField
from wtforms.validators import InputRequired, EqualTo

class RegistrationForm(FlaskForm):
	username = StringField("Username: ", validators=[InputRequired(message="Username cannot be blank.")])
	email = StringField("Email: ", validators=[InputRequired(message="Email cannot be blank.")])
	password = PasswordField("Password: ", validators=[InputRequired(message="Password cannot be blank.")])
	password2 = PasswordField("Repeat password: ", validators=[InputRequired(message="Password cannot be blank."), EqualTo('password', message="Passwords do not match")])
	submit = SubmitField("Submit")

class LoginForm(FlaskForm):
	username = StringField("Username: ", validators=[InputRequired(message="Username cannot be blank.")])
	password = PasswordField("Password: ", validators=[InputRequired(message="Password cannot be blank.")])
	submit = SubmitField("Submit")