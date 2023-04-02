from flask_wtf import FlaskForm
from wtforms import SubmitField, StringField, IntegerField, RadioField, FloatField, DecimalField, PasswordField
from wtforms.validators import InputRequired, NumberRange, EqualTo, ValidationError, Length

class RegistrationForm(FlaskForm):
	username = StringField("Username: ", validators=[InputRequired(message="Username cannot be blank.")])
	password = PasswordField("Password: ", validators=[InputRequired(message="Password cannot be blank.")])
	password2 = PasswordField("Re-enter password: ", validators=[InputRequired(message="Password cannot be blank."), EqualTo('password', message="Passwords do not match")])
	submit = SubmitField("Submit")

class LoginForm(FlaskForm):
	username = StringField("Username: ", validators=[InputRequired(message="Username cannot be blank.")])
	password = PasswordField("Password: ", validators=[InputRequired(message="Password cannot be blank.")])
	submit = SubmitField("Submit")