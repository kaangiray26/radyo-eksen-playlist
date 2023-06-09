import fs from "fs";
import { exit } from "process";
import { JSDOM } from "jsdom";

class Service {
    constructor() {
        this.ready = false;
        this.user_id = null;
        this.latest_playlist_tracks = [];

        // Read credentials
        this.config = {
            client_id: process.env.client_id,
            client_secret: process.env.client_secret,
            refresh_token: process.env.refresh_token
        }
    }

    async init() {
        await this.refreshToken();
    }

    async run() {
        console.log("Running...");
        // Check playlist
        await this.checkPlaylist();
        await this.getLastChecked();

        let songs = await this.getLast10Songs();

        if (!songs.length) {
            console.log("=> Up to date.");
            return
        }

        let uris = await this.getSongUris(songs);

        // Add items to playlist
        await this.addItemsToPlaylist(uris);
        return
    }

    async auth() {
        let url = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
            client_id: this.config.client_id,
            response_type: "code",
            redirect_uri: "http://localhost:3000/auth",
            scope: "playlist-modify-public playlist-modify-private playlist-read-private"

        });
        console.log("\nPlease visit the following URL to authenticate:");
        console.log("\x1b[32m%s\x1b[0m", url);
    }

    async getAccessToken(code) {
        if (!code) throw new Error("No authorization code provided.");

        console.log("=> Authorizing...");

        let response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Authorization": "Basic " + Buffer.from(this.config.client_id + ":" + this.config.client_secret).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: "http://localhost:3000/auth"
            })
        })
            .then(res => res.json())
            .catch(err => null);

        if (!response) {
            console.log("Authorization failed!");
            exit();
        }

        // Save response to credentials
        this.config.access_token = response.access_token;
        this.config.refresh_token = response.refresh_token;

        // Save to file
        fs.writeFileSync("credentials.json", JSON.stringify(this.config, null, 4));
        exit();
    }

    async refreshToken() {
        console.log("=> Refreshing access token...");
        let response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Authorization": "Basic " + Buffer.from(this.config.client_id + ":" + this.config.client_secret).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: this.config.refresh_token
            })
        })
            .then(res => res.json())
            .catch(err => null);

        if (!response) {
            console.log("Refresh failed!");
            exit();
        }

        // Save response to credentials
        this.config.access_token = response.access_token;

        // Get user ID
        await this.getUserID();

        this.ready = true;
    }

    async getUserID() {
        let response = await fetch("https://api.spotify.com/v1/me", {
            headers: {
                "Authorization": "Bearer " + this.config.access_token
            }
        })
            .then(res => res.json())
            .catch(err => null);

        if (!response) {
            console.log("=> Could not get user ID.");
            return
        }

        this.config.user_id = response.id;
    }

    async getLast10Songs() {
        if (!this.ready) {
            console.log("=> Service not ready!");
            return
        }

        // Get last checked
        console.log("=> Getting last 10 songs...");

        let response = await fetch("https://radioeksen.com/umbraco/surface/Partial/_EksenLast10Songs")
            .then(res => res.text())
            .catch(err => null);

        if (!response) {
            console.log("Failed to get last 10 songs from Radyo Eksen.");
            return
        }

        // Get song titles
        let dom = new JSDOM(response);
        let songs = [...dom.window.document.querySelectorAll(".music_line")]
            .filter(song => song.querySelector('.plyr__time--duration').textContent > this.config.last_checked)
            .map(song => song.querySelector('.music-name').textContent)
            .reverse();
        return songs;
    }

    async checkPlaylist() {
        // Construct date string
        let dt = new Date();
        let date = dt.getFullYear() + "-" + (dt.getMonth() + 1).toString().padStart(2, "0") + "-" + dt.getDate().toString().padStart(2, "0");
        let playlist_name = date + " Radyo Eksen";

        console.log("=> Checking playlist...");
        let response = await fetch("https://api.spotify.com/v1/me/playlists", {
            headers: {
                "Authorization": "Bearer " + this.config.access_token
            }
        })
            .then(res => res.json())
            .then(res => res.items);

        // Check if playlist exists
        if (!response.filter(playlist => playlist.name === playlist_name).length) {
            await this.createPlaylist(playlist_name);
            return;
        }

        // Get playlist ID
        this.config.playlist_id = response.filter(playlist => playlist.name === playlist_name)[0].id;

        // Get latest tracks
        let total_tracks = response.filter(playlist => playlist.id === this.config.playlist_id)[0].tracks.total;
        this.latest_playlist_tracks = await this.getPlaylistItems(total_tracks);
    }

    async getPlaylistItems(total_tracks) {
        let response = await fetch(`https://api.spotify.com/v1/playlists/${this.config.playlist_id}/tracks?` + new URLSearchParams({
            fields: "items(track(uri))",
            offset: total_tracks > 20 ? total_tracks - 20 : 0,
        }), {
            headers: {
                "Authorization": "Bearer " + this.config.access_token,
            }
        })
            .then(res => res.json())
            .then(res => res.items)
            .catch(err => null);

        if (!response) {
            console.log("=> Could not get playlist items.");
            return
        }

        // Construct track IDs
        let tracks = response.map(track => track.track.uri);
        return tracks;
    }

    async getLastChecked() {
        let total_items = await fetch(`https://api.spotify.com/v1/playlists/${this.config.playlist_id}?` + new URLSearchParams({
            fields: "tracks.total"
        }), {
            headers: {
                "Authorization": "Bearer " + this.config.access_token,
            }
        })
            .then(res => res.json())
            .then(res => res.tracks.total)
            .catch(err => null);

        if (!total_items) {
            this.config.last_checked = "00:00";
            return
        }

        let tracks = await fetch(`https://api.spotify.com/v1/playlists/${this.config.playlist_id}/tracks?` + new URLSearchParams({
            fields: "items(added_at)",
            limit: 1,
            offset: total_items - 1
        }), {
            headers: {
                "Authorization": "Bearer " + this.config.access_token,
            }
        })
            .then(res => res.json())
            .then(res => res.items[0])
            .catch(err => null);

        if (!tracks) {
            this.config.last_checked = "00:00";
            return
        }

        this.config.last_checked = new Date(tracks.added_at).toLocaleTimeString('tr-TR', { timeZone: 'Turkey', hour: "2-digit", minute: "2-digit" });
    }

    async createPlaylist(playlist_name) {
        console.log("=> Creating playlist...");
        let response = await fetch(`https://api.spotify.com/v1/users/${this.config.user_id}/playlists`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + this.config.access_token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: playlist_name,
                description: "Radyo Eksen Sabah Programı Çalma Listesi",
                public: true
            })
        })
            .then(res => res.json())
            .catch(err => null);

        if (!response) {
            console.log("=> Could not create playlist.");
            return
        }

        // Save credentials to file
        this.config.playlist_id = response.id;
    }

    async addItemsToPlaylist(uris) {
        // Add items
        console.log(`=> Adding ${uris.length} items to playlist...`);
        let response = await fetch(`https://api.spotify.com/v1/playlists/${this.config.playlist_id}/tracks`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + this.config.access_token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "uris": uris
            })
        })
            .then(res => res.json())
            .catch(err => null);

        if (!response) {
            console.log("! Can't add items to playlist.");
            return
        }

        // Save last_checked
        console.log("=> Done.");
    }

    async search(query) {
        // Search for song
        let response = await fetch("https://api.spotify.com/v1/search?" + new URLSearchParams({
            q: query,
            type: "track",
            limit: 1
        }), {
            headers: {
                "Authorization": "Bearer " + this.config.access_token,
            }
        })
            .then(res => res.json())
            .then(res => res.tracks.items[0])
            .catch(err => null);

        if (!response) {
            return null
        }

        if (this.latest_playlist_tracks.includes(response.uri)) {
            return null
        }

        return response.uri;
    }

    async getSongUris(songs) {
        let uris = [];
        console.log("=> Searching for items...");
        for (let song of songs) {
            let uri = await this.search(song);
            if (!uri) continue;
            uris.push(uri);
        }
        return uris;
    }
}

export { Service }