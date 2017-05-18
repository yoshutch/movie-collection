'use strict';

function MovieCollection(){
	this.userName = document.getElementById('user-name');
	this.userPic = document.getElementById('user-pic');
	this.searchTextField = document.getElementById('search');
	this.searchResults = document.getElementById('search-results');
	this.collection = document.getElementById('collection');

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
	this.settingsRef = this.database.ref("settings");
	var self = this;
	this.settingsRef.once("value").then(function(snapshot){
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

		this.loadCollection(user.uid);

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
			picNode.setAttribute("src", this.posterUrl(results[i].poster_path, MovieCollection.POSTER_SMALL));
			node.appendChild(picNode);
		}
		var buttonNode = document.createElement("BUTTON");
		var buttonText = document.createTextNode("Add to Collection");
		buttonNode.dataset.movieId = results[i].id;
		buttonNode.appendChild(buttonText);
		node.appendChild(buttonNode);
		this.searchResults.appendChild(node);
	}
};

MovieCollection.prototype.loadCollection = function (collectionId){
	console.log("loading collection");
	this.collectionRef = this.database.ref("collections/" + collectionId);
	this.moviesRef = this.database.ref("collections/" + collectionId + "/movies");

	//make sure we remove all previous listeners.
	this.moviesRef.off();

	var setMovie = function(data) {
		var val = data.val();
		var movieId = data.key;
		this.displayMovieInCollection(movieId, val.title, val.copies);
	}.bind(this);
	this.moviesRef.on('child_added', setMovie);
	this.moviesRef.on('child_changed', setMovie);
};

MovieCollection.prototype.getMovieInfo = function (movieId, callback){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
			if (xmlhttp.status == 200) {
				console.log("200");
				callback(JSON.parse(xmlhttp.responseText));
			}
			else if (xmlhttp.status == 400) {
				alert('There was an error 400');
			}
			else {
				alert('something else other than 200 was returned');
			}
		}
	};

	xmlhttp.open("GET", "https://api.themoviedb.org/3/movie/" + movieId +"?api_key=" + this.tmdbApiKey + "&language=en-US", true);
	xmlhttp.send();
};

MovieCollection.MOVIE_TEMPLATE =
	'<div class="movie">' +
	'<div class="title"></div>' +
	'<img class="poster"/>' +
	'<ul class="copies"></ul> ' +
	'</div>';
MovieCollection.POSTER_BASE_URL = "https://image.tmdb.org/t/p/";
MovieCollection.POSTER_SMALL = "w92";
MovieCollection.POSTER_MEDIUM = "w154";

MovieCollection.prototype.displayMovieInCollection = function (movieId, title, copies){
	var div = document.getElementById(movieId);
	if (!div) {
		var container = document.createElement('div');
		container.innerHTML = MovieCollection.MOVIE_TEMPLATE;
		div = container.firstChild;
		div.setAttribute('id', movieId);
		this.collection.appendChild(div);
	}
	this.getMovieInfo(movieId, function(movieInfo){
		console.log(movieInfo);
		div.querySelector('.poster').setAttribute('src', this.posterUrl(movieInfo.poster_path, MovieCollection.POSTER_MEDIUM));
	}.bind(this));

	div.querySelector('.title').innerHTML = title;
	div.querySelector('.copies').innerHTML = "";
	if (copies){
		for (var i = 0; i < copies.length; i ++) {
			var li = document.createElement('li');
			li.appendChild(document.createTextNode(copies[i]));
			div.querySelector('.copies').appendChild(li);
		}
	}
};

MovieCollection.prototype.posterUrl = function (posterPath, size) {
	return MovieCollection.POSTER_BASE_URL + size + "/" + posterPath;
};

window.onload = function () {
	window.movieCollection = new MovieCollection();
};