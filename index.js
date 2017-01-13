'use strict';

const Promise = require('bluebird');
const promiserToLambda = require('promiser-to-lambda');
//const Twit = require('twit');
const pgp = require('pg-promise')({
	promiseLib: Promise,
});

const db = pgp({
	host: process.env.DATABASE_HOST,
	port: process.env.DATABASE_PORT || 5432,
	database: process.env.DATABASE_NAME,
	user: process.env.DATABASE_USER,
	password: process.env.DATABASE_PASSWORD,
});

/*
const twitter = new Twit({
	consumer_key: process.env.TWITTER_CONSUMER_KEY,
	consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
	access_token: process.env.TWITTER_ACCESS_TOKEN,
	access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});
*/

exports.handler = promiserToLambda(event => {
	console.log('Fetching latest post from db');
	return db.oneOrNone('select title,slug from posts where published_at < now() order by published_at desc limit 1')
		.then(latestPost => {
			console.log('latest post:', latestPost);
		});
});
