'use strict';

MovieCollection.MOVIE_TEMPLATE =
	'<div class="movie thumbnail">' +
	'<div class="title"></div>' +
	'<img class="poster"/>' +
	'<ul class="copies list-inline"></ul> ' +
	'</div>';
MovieCollection.SEARCHED_MOVIE_TEMPLATE =
	'<div class="movie-sm thumbnail">' +
	'<div class="title"></div>' +
	'<img class="poster"/>' +
	'<div class="btn-group">' +
		'<button class="btn btn-default dropdown-toggle" data-toggle="dropdown" ' +
			'aria-haspopup="true" aria-expanded="false">Add To Collection<span class="caret"></span></button>' +
		'<ul id="add-copy-list" class="dropdown-menu">' +
			//to be populated from database
		'</ul>' +
	'</div>' +
	'</div>';
MovieCollection.FILTER_CHECKBOX_TEMPLATE =
	'<div class="checkbox">' +
	'<label>' +
	'<input type="checkbox">' +
	'</label>' +
	'</div>';
MovieCollection.POSTER_BASE_URL = "https://image.tmdb.org/t/p/";
MovieCollection.POSTER_SMALL = "w92";
MovieCollection.POSTER_MEDIUM = "w154";
MovieCollection.TMDB_BASE_URL = "https://api.themoviedb.org/3";

function MovieCollection(){
	this.userName = document.getElementById('user-name');
	this.userPic = document.getElementById('user-pic');
	this.searchTextField = document.getElementById('search');
	this.search2TextField = document.getElementById('search2');
	this.searchResults = document.getElementById('search-results');
	this.collection = document.getElementById('collection');
	this.genreFilterGroup = document.getElementById('genre-filter-group');
	this.copiesFilterGroup = document.getElementById('copies-filter-group');

	this.signInButton = document.getElementById('sign-in');
	this.signOutButton = document.getElementById('sign-out');
	this.searchButton = document.getElementById('search-button');
	this.search2Button = document.getElementById('search2-button');
	this.showFilterButton = document.getElementById('show-filters');

	this.genreSet = new Set();
	this.copySet = new Set();

	this.signOutButton.addEventListener('click', this.signOut.bind(this));
	this.signInButton.addEventListener('click', this.signIn.bind(this));
	this.searchButton.addEventListener('click', function(){
		this.searchForMovies(this.searchTextField.value).bind(this);
	}.bind(this));
	this.search2Button.addEventListener('click', function(){
		this.searchForMovies(this.search2TextField.value).bind(this);
	}.bind(this));
	this.searchTextField.addEventListener('keypress', function(e){
		var key = e.which || e.keyCode;
		if (key === 13){
			this.searchForMovies(this.searchTextField.value);
			$("#search-modal").modal();
		}
	}.bind(this));
	this.search2TextField.addEventListener('keypress', function(e){
		var key = e.which || e.keyCode;
		if (key === 13){
			this.searchForMovies(this.search2TextField.value);
		}
	}.bind(this));
	this.showFilterButton.addEventListener('click', function(){
		console.log(this.genreSet, this.copySet);
		this.loadFilterOptions();
	}.bind(this));

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
	this.settingsRef.once("value").then(function(snapshot){
		this.tmdbApiKey = snapshot.child("tmdb/apikey").val();
		this.copyTypes = snapshot.child("copy-types").val();
		if (this.copyTypes){
			this.copyTypesHtml = "";
			for (var i = 0; i < this.copyTypes.length; i ++){
				this.copyTypesHtml += '<li><a class="add-btn" href="#" data-copy-type="' + this.copyTypes[i] + '">' + this.copyTypes[i] + '</a></li>';
			}
		}
	}.bind(this));
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
		this.userUid = user.uid;

		// Show user's profile and sign-out button.
		this.userName.style.display = "block";
		this.userPic.style.display = "block";
		this.signOutButton.style.display = "block";

		// Hide sign-in button.
		this.signInButton.style.display = "none";

		this.loadCollection(this.userUid);

	} else { // User is signed out!
		// Hide user's profile and sign-out button.
		this.userName.style.display = "none";
		this.userPic.style.display = "none";
		this.signOutButton.style.display = "none";

		// Show sign-in button.
		this.signInButton.style.display = "block";
	}
};

MovieCollection.prototype.searchForMovies = function (searchValue){
	var path = "/search/movie?api_key=" + this.tmdbApiKey +"&query=" + searchValue + "&page=1&include_adult=false&language=en-US";
	callTmdbApi(path, function(result){
		this.populateSearchResults(result);
	}.bind(this));
};

MovieCollection.prototype.populateSearchResults = function (result){
	this.searchResults.innerHTML = "";
	var results = result.results;
	for (var i = 0; i < results.length; i ++){
		var container = document.createElement('div');
		container.innerHTML = MovieCollection.SEARCHED_MOVIE_TEMPLATE;
		var div = container.firstChild;
		this.searchResults.appendChild(div);
		div.setAttribute('data-movie-id', results[i].id);
		div.setAttribute('data-movie-title', results[i].title);
		div.querySelector('.title').innerHTML = results[i].title;
		if (results[i].poster_path != undefined){
			div.querySelector('.poster').setAttribute("src", posterUrl(results[i].poster_path, MovieCollection.POSTER_MEDIUM));
		}
		var addCopyList = div.querySelector('#add-copy-list');
		addCopyList.innerHTML = this.copyTypesHtml;
		this.movieCopiesAlreadyInCollection(results[i].id, this.userUid, function (movieId, alreadyOwnedCopies){
			for (var j = 0; j < alreadyOwnedCopies.length; j ++){
				var checkNode = document.createElement("span");
				checkNode.className = "glyphicon glyphicon-ok";
				var alreadyOwnedCopyButton = addCopyList.querySelector('li a[data-copy-type="' + alreadyOwnedCopies[j] + '"]');
				alreadyOwnedCopyButton.appendChild(checkNode);
				alreadyOwnedCopyButton.className = "remove-btn";
			}
		});
	}
	var self = this;
	var addButtonListener = function(event){
		var $button = $(this);
		var $parent = $button.parent().parent().parent().parent();
		self.addMovieToCollection($parent.data("movie-id"), $parent.data("movie-title"), $button.data("copy-type"), self.userUid, function(error){
			if (error) {
				console.error("Data could not be saved." + error);
			} else {
				console.log("Data saved successfully.");
				$button.addClass("remove-btn").removeClass("add-btn")
					.unbind().on('click', removeButtonListener)
					.append('<span class="glyphicon glyphicon-ok"></span>');
			}
		});
	};
	var removeButtonListener = function(event){
		var $button = $(this);
		var $parent = $button.parent().parent().parent().parent();
		self.removeMovieCopyFromCollection($parent.data("movie-id"), $button.data("copy-type"), self.userUid, function(error){
			if (error) {
				console.error("Data could not be removed." + error);
			} else {
				console.log("Data removed successfully.");
				$button.removeClass("remove-btn").addClass("add-btn")
					.unbind().on('click', addButtonListener)
					.find("span.glyphicon").remove();
				console.log($button);
			}
		});
	};
	// add button functionality
	$(".add-btn").on('click', addButtonListener);
	// remove button functionality
	$(".remove-btn").on('click', removeButtonListener);

};

// Returns an array of the copies already in the collection
MovieCollection.prototype.movieCopiesAlreadyInCollection = function(movieId, collectionId, callback){
	if (!this.moviesRef) {
		this.moviesRef = this.database.ref("collections/" + collectionId + "/movies");
	}
	this.moviesRef.child(movieId).once('value', function(snapshot){
		var val = snapshot.val();
		var exists = (val !== null);
		if (exists) {
			callback(movieId, toArray(val.copies));
		}
	});
};

MovieCollection.prototype.addMovieToCollection = function (movieId, title, copyType, collectionId, callback) {
	console.log("adding movie to collection: ", movieId, title, copyType);
	if (!this.moviesRef) {
		this.moviesRef = this.database.ref("collections/" + collectionId + "/movies");
	}
	this.moviesRef.child(movieId).once('value', function(snapshot){
		if (snapshot.val() !== null){
			// movie exists in your collection, adding copyType to copies
			var alreadyExistingCopies = toArray(snapshot.val().copies);
			if (alreadyExistingCopies){
				// check if copy is already there
				for (var i = 0; i < alreadyExistingCopies.length; i ++){
					if (alreadyExistingCopies[i] === copyType){
						callback("Copy: " + copyType + " already exists in your collection");
						return;
					}
				}
			}
			this.moviesRef.child(movieId + "/copies").push().set(copyType, callback);
		} else {
			// movie doesn't already exist in your collection
			this.moviesRef.child(movieId).set({"title": title}, function(error){
				if (error){
					callback(error);
				} else {
					this.moviesRef.child(movieId + "/copies").push().set(copyType, callback);
				}
			}.bind(this));
		}
	}.bind(this));
};

MovieCollection.prototype.removeMovieCopyFromCollection = function (movieId, copyType, collectionId, callback) {
	console.log("removing movie copy from collection: ", movieId, copyType);
	if (!this.moviesRef) {
		this.moviesRef = this.database.ref("collections/" + collectionId + "/movies");
	}
	this.moviesRef.child(movieId).once('value', function(snapshot){
		if (snapshot.val() !== null){
			var movieCopiesAlreadyInCollection = snapshot.val().copies;
			var keys = Object.keys(movieCopiesAlreadyInCollection);
			for (var i = 0; i < keys.length; i ++){
				if (movieCopiesAlreadyInCollection[keys[i]] === copyType){
					if (i === 0){
						// if the only copy was the one removed then remove the movie entirely
						this.moviesRef.child(movieId).remove(callback);
					} else {
						// otherwise remove just the copy
						this.moviesRef.child(movieId + "/copies/" + keys[i]).remove(callback);
					}
					return;
				}
			}
			callback("Copy: " + copyType + " does not exist in your collection. Nothing was removed.");
		} else {
			callback("Movie is not in your collection. Nothing was removed.");
		}
	}.bind(this));
};

MovieCollection.prototype.loadCollection = function (collectionId){
	console.log("loading collection");
	this.collectionRef = this.database.ref("collections/" + collectionId + "/movies").orderByChild('title')
	// if (!this.moviesRef) {
	// 	this.moviesRef = this.database.ref("collections/" + collectionId + "/movies").orderByChild('title');
	// }

	//make sure we remove all previous listeners.
	this.collectionRef.off();

	var setMovie = function(data) {
		var val = data.val();
		var movieId = data.key;
		this.displayMovieInCollection(movieId, val.title, toArray(val.copies));
	}.bind(this);
	this.collectionRef.on('child_added', setMovie);
	this.collectionRef.on('child_changed', setMovie);
	this.collectionRef.on('child_removed', function(childSnapshot, prevChildName){
		var removedMovie = document.getElementById(childSnapshot.key);
		removedMovie.parentNode.removeChild(removedMovie);
	})
};

MovieCollection.prototype.getMovieInfo = function (movieId, callback){
	callTmdbApi("/movie/" + movieId + "?api_key=" + this.tmdbApiKey + "&language=en-US",
		function(result){
			callback(result);
		}
	);
};

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
		div.querySelector('.poster').setAttribute('src', posterUrl(movieInfo.poster_path, MovieCollection.POSTER_MEDIUM));
		for (var i = 0; i < movieInfo.genres.length; i ++) {
			this.genreSet.add(movieInfo.genres[i].name);
		}
	}.bind(this));

	div.querySelector('.title').innerHTML = title;
	div.querySelector('.copies').innerHTML = "";
	if (copies){
		for (var i = 0; i < copies.length; i ++) {
			this.copySet.add(copies[i]);
			var li = document.createElement('li');
			li.className = "copy label label-default";
			li.appendChild(document.createTextNode(copies[i]));
			var removeContainer = document.createElement('div');
			removeContainer.innerHTML = '<button type="button" class="close close-small" aria-label="Close"><span aria-hidden="true">&times;</span></button>';
			var removeNode = removeContainer.firstChild;
			li.appendChild(removeNode);
			div.querySelector('.copies').appendChild(li);
		}
	}
};

MovieCollection.prototype.loadFilterOptions = function (){
	console.log("loading filter options");
	this.genreSet.forEach(function(item){
		this.genreFilterGroup.querySelector('.panel-body').appendChild(checkbox(item, 'genre-filter'));
	}.bind(this));
	this.copySet.forEach(function(item){
		this.copiesFilterGroup.querySelector('.panel-body').appendChild(checkbox(item, 'copies-filter'));
	}.bind(this));
};

const checkbox = function (labelText, checkboxName) {
	var checkboxId = checkboxName + "__" + labelText.replace(' ', '_');
	var checkboxDiv = document.createElement('div');
	checkboxDiv.className = 'checkbox';
	var label = document.createElement('label');
	label.setAttribute('for', checkboxId);
	var input = document.createElement('input');
	input.setAttribute('id', checkboxId);
	input.setAttribute('type', 'checkbox');
	input.setAttribute('name', checkboxName);
	input.setAttribute('value', labelText);
	label.appendChild(input);
	label.appendChild(document.createTextNode(labelText));
	checkboxDiv.appendChild(label);
	return checkboxDiv;
};

const posterUrl = function (posterPath, size) {
	return MovieCollection.POSTER_BASE_URL + size + "/" + posterPath;
};

const toArray = function (objArray) {
	if (objArray){
		return Object.keys(objArray).map(function (e) {
			return objArray[e];
		});
	}
};

const callTmdbApi = function(path, successCallback, failCallback){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
			if (xmlhttp.status == 200) {
				successCallback(JSON.parse(xmlhttp.responseText));
			} else {
				console.error("error making call..", xmlhttp.responseText);
				failCallback(xmlhttp.responseText);
			}
		}
	};
	xmlhttp.open("GET", MovieCollection.TMDB_BASE_URL + path, true);
	xmlhttp.send();
};

window.onload = function () {
	window.movieCollection = new MovieCollection();
};