'use strict';

function MovieCollection(){
	this.userName = document.getElementById('user-name');
	this.userPic = document.getElementById('user-pic');
	this.searchTextField = document.getElementById('search');
	this.searchResults = document.getElementById('search-results');

	this.signInButton = document.getElementById('sign-in');
	this.signOutButton = document.getElementById('sign-out');
	this.searchButton = document.getElementById('search-button');

	this.signOutButton.addEventListener('click', this.signOut.bind(this));
	this.signInButton.addEventListener('click', this.signIn.bind(this));
	this.searchButton.addEventListener('click', this.searchForMovies.bind(this));

	this.initFirebase();
}

// Sets up shortcuts to Firebase features and initiate firebase auth.
MovieCollection.prototype.initFirebase = function () {
	// Shortcuts to Firebase SDK features.
	this.auth = firebase.auth();
	this.database = firebase.database();
	this.storage = firebase.storage();
	// Initiates Firebase auth and listen to auth state changes.
	this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
};

MovieCollection.prototype.initSettings = function () {
	this.settings = this.database.ref("settings");
	var self = this;
	this.settings.once("value").then(function(snapshot){
		self.tmdbApiKey = snapshot.child("tmdb/apikey").val();
	});
};

// Signs-in.
MovieCollection.prototype.signIn = function () {
	// Sign in Firebase using popup auth and Google as the identity provider.
	var provider = new firebase.auth.GoogleAuthProvider();
	this.auth.signInWithPopup(provider);
};

// Signs-out.
MovieCollection.prototype.signOut = function () {
	// Sign out of Firebase.
	this.auth.signOut();
};

// Triggers when the auth state change for instance when the user signs-in or signs-out.
MovieCollection.prototype.onAuthStateChanged = function (user) {
	if (user) { // User is signed in!
		this.initSettings();
		// Get profile pic and user's name from the Firebase user object.
		var profilePicUrl = user.photoURL;
		var userName = user.displayName;

		// Set the user's profile pic and name.
		this.userPic.src = profilePicUrl;
		this.userName.textContent = userName;

		// Show user's profile and sign-out button.
		this.userName.style.display = "block";
		this.userPic.style.display = "block";
		this.signOutButton.style.display = "block";

		// Hide sign-in button.
		this.signInButton.style.display = "none";

	} else { // User is signed out!
		// Hide user's profile and sign-out button.
		this.userName.style.display = "none";
		this.userPic.style.display = "none";
		this.signOutButton.style.display = "none";

		// Show sign-in button.
		this.signInButton.style.display = "block";
	}
};

MovieCollection.prototype.searchForMovies = function (){
	var xmlhttp = new XMLHttpRequest();
	var self = this;
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
			if (xmlhttp.status == 200) {
				console.log("200");
				self.populateSearchResults(JSON.parse(xmlhttp.responseText));
			}
			else if (xmlhttp.status == 400) {
				alert('There was an error 400');
			}
			else {
				alert('something else other than 200 was returned');
			}
		}
	};

	xmlhttp.open("GET", "https://api.themoviedb.org/3/search/movie?api_key=" + this.tmdbApiKey +"&query=" +
		this.searchTextField.value + "&page=1&include_adult=false&language=en-US", true);
	xmlhttp.send();
};

MovieCollection.prototype.populateSearchResults = function (result){
	this.searchResults.innerHTML = "";
	var results = result.results;
	for (var i = 0; i < results.length; i ++){
		var node = document.createElement("DIV");
		node.className = "thumbnail";
		var textNode = document.createTextNode(results[i].title);
		node.appendChild(textNode);
		if (results[i].poster_path != undefined){
			var picNode = document.createElement("IMG");
			picNode.setAttribute("src", "https://image.tmdb.org/t/p/w92/" + results[i].poster_path);
			node.appendChild(picNode);
		}
		var buttonNode = document.createElement("BUTTON");
		var buttonText = document.createTextNode("Add to Collection");
		buttonNode.appendChild(buttonText);
		node.appendChild(buttonNode);
		this.searchResults.appendChild(node);
	}
};

window.onload = function () {
	window.movieCollection = new MovieCollection();
};