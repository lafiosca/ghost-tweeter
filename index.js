'use strict';

const Promise = require('bluebird');
const promiserToLambda = require('promiser-to-lambda');
const Twit = require('twit');
const pgp = require('pg-promise')({
	promiseLib: Promise,
});

const ghostUrl = process.env.GHOST_URL;

const db = pgp({
	host: process.env.DATABASE_HOST,
	port: process.env.DATABASE_PORT || 5432,
	database: process.env.DATABASE_NAME,
	user: process.env.DATABASE_USER,
	password: process.env.DATABASE_PASSWORD,
});

const twitter = new Twit({
	consumer_key: process.env.TWITTER_CONSUMER_KEY,
	consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
	access_token: process.env.TWITTER_ACCESS_TOKEN,
	access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

exports.handler = promiserToLambda(event => {
	console.log('Fetching Twitter screen name');
	return twitter.get('account/verify_credentials')
		.then(resp => resp.data.screen_name)
		.then(screenName => {
			console.log(`Twitter screen name: ${screenName}`);
			console.log('Fetching latest post from Ghost database and recent tweets from Twitter');
			return [
				screenName,
				db.oneOrNone('SELECT title,slug FROM posts WHERE status = \'published\' AND published_at < now() ORDER BY published_at DESC LIMIT 1'),
				twitter.get('statuses/user_timeline', { screen_name: screenName, trim_user: true })
					.then(resp => resp.data),
			];
		})
		.spread((screenName, latestPost, recentTweets) => {
			console.log(`Latest post title: ${latestPost.title}`);

			console.log(`Scanning tweets for slug '${latestPost.slug}'`);

			const postUrl = `${ghostUrl}${latestPost.slug}/`;

			for (let i = 0; i < recentTweets.length; ++i) {
				if (!recentTweets[i].entities.urls.length) {
					continue;
				}
				if (recentTweets[i].entities.urls[0].expanded_url === postUrl) {
					console.log(`Found tweet: https://twitter.com/${screenName}/status/${recentTweets[i].id_str}`);
					return [screenName, null];
				}
			}

			console.log('Did not find tweet, posting now...');

			let status = `"${latestPost.title}" ${postUrl}`;

			console.log(status);

			return [
				screenName,
				twitter.post('statuses/update', { status }),
			];
		})
		.spread((screenName, resp) => {
			if (resp) {
				console.log(`Posted tweet: https://twitter.com/${screenName}/status/${resp.data.id_str}`);
			}
		});
});
