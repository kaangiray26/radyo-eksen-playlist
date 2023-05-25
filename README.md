# radyo-eksen-playlist
Automated Spotify Playlist Generator for Radyo Eksen

> Check out generated playlists here:
[Profile](https://open.spotify.com/user/31v5bbakuh7445bhsw7cqknesad4/playlists)

## Setting things up
Change your directory and install dependencies
```
cd radyo-eksen-playlist
npm i
```

Set the following environment variables:
```
client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET
```

Run the `auth.js` and follow the instructions
```
node auth.js
```

Once you're authorized you will see a newly created file `credentials.json`. Now you can add the `refresh_token` from the `credentials.json` to your environment variables:
```
client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET
refresh_token=YOUR_REFRESH_TOKEN
```

Finally, run the application
```
node index.js
```