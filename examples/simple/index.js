// Require and create a new Riposte instance.
let riposte = new (require('../../libs/index.js'))();

// Optionally, here you could configure Riposte options and handlers using:  riposte.set();


console.log("\n\n/* ******************** Riposte Success Example ******************** */\n");

// Create a new reply instance.
let reply = riposte.createReply();

// Add data to the reply.
reply.setData({ "firstName": "McLovin", "DOB": "06/03/1981"});

// Convert the reply instance to an object and HTTP status code that can be returned.
reply.toObject(undefined, function(err, replyObject, replyStatusCode) {
	if(err) {
		console.log(err);
	} else {
		console.log("HTTP Status Code: %s\nReply: %s", replyStatusCode, JSON.stringify(replyObject, undefined, 2));
	}
});


console.log("\n\n/* ******************** Riposte Error Example ********************* */\n");

// Now let's add some errors.
reply.addErrors(new Error("Something terrible has happened."), function(err, replyErrors) {
	if(err) {
		console.log(err);
	} else {
		// Convert the reply instance to an object and status code that can be returned.
		reply.toObject(undefined, function(err, replyObject, replyStatusCode) {
			if(err) {
				console.log(err);
			} else {
				console.log("HTTP Status Code: %s\nReply: %s", replyStatusCode, JSON.stringify(replyObject, undefined, 2));
			}
		});
	}
});