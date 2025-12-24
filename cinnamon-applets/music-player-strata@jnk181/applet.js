const Main = imports.ui.main;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Interfaces = imports.misc.interfaces;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;

const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

// In your constructor, initialize a map to store players
this._players = new Map();

// This function finds the best player to control right now
function _getActivePlayer() {
    let players = Array.from(this._players.values());
    if (players.length === 0) return null;

    // Try to find one that is actually 'Playing'
    let active = players.find(p => p._playerStatus === "Playing");

    // Fallback to the first player in the list if none are playing
    return active || players[0];
}

class MediaPlayer {
    constructor(name, updateCallback = () => { }) {
        this.name = name;

        this.mediaServer = null;
        this.mediaServerPlayer = null;
        this.prop = null;
        this.propChangeId = null;

        this.isPlaying = false;
        this.songArtist = "";
        this.songTitle = "";
        this.appIcon = "multimedia-audio-player-symbolic";

        //this.menuItem = new PopupMenu.PopupMenuItem(this.name);

        this.updateCallback = updateCallback;

        this.initDBus();
    }

    initDBus() {
        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_NAME, this.name, (proxy, error) => {
            if (error) {
                global.log(error);
            } else {
                this.mediaServer = proxy;

                if (this.mediaServer.DesktopEntry) {
                    this.appIcon = this.mediaServer.DesktopEntry;
                }

                //this.menuItem.setLabel(this.mediaServer.Identity);

                this.updateCallback();
            }
        });

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_PLAYER_NAME, this.name, (proxy, error) => {
            if (error) {
                global.log(error);
            } else {
                this.mediaServerPlayer = proxy;
                this.setMetadata(this.mediaServerPlayer.Metadata);
                this.setStatus(this.mediaServerPlayer.PlaybackStatus);

                this.updateCallback();
            }
        });

        Interfaces.getDBusPropertiesAsync(this.name, MEDIA_PLAYER_2_PATH, (proxy, error) => {
            if (error) {
                global.log(error);
            } else {
                this.prop = proxy;

                this.propChangeId = this.prop.connectSignal('PropertiesChanged', (proxy, sender, [iface, props]) => {
                    if (props.PlaybackStatus) {
                        this.setStatus(props.PlaybackStatus.unpack());
                    }

                    if (props.Metadata) {
                        this.setMetadata(props.Metadata.deep_unpack());
                    }

                    this.updateCallback();
                });
            }
        });
    }

    setStatus(status) {
        if (!status) { return; }
        this.isPlaying = status == "Playing";
    }

    setMetadata(metadata) {
        if (!metadata) { return; }

        if (metadata['mpris:artUrl']) {
            // Capa do álbum
            this.artUrl = metadata['mpris:artUrl'].unpack();
        }

        this.songArtist = "";
        if (metadata['xesam:artist']) {
            switch (metadata["xesam:artist"].get_type_string()) {
                case 's':
                    // smplayer sends a string
                    this.songArtist = metadata["xesam:artist"].unpack();
                    break;
                case 'as':
                    // others send an array of strings
                    this.songArtist = metadata["xesam:artist"].deep_unpack().join(", ");
                    break;
            }
        }

        this.songTitle = "";
        if (metadata["xesam:title"]) {
            this.songTitle = metadata["xesam:title"].unpack();
        }

       for (let key in metadata) {
            let value = metadata[key];
            global.log(`KEY: ${key} | TYPE: ${value.get_type_string()} | VALUE: ${value.unpack()}`);
        }
        
    }

    destroy() {
        if (this.prop && this.propChangeId) {
            this.prop.disconnectSignal(this.propChangeId);
            this.propChangeId = null;
        }

        //this.menuItem.destroy();
    }
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,
    artistLabel: null,
    titleLabel: null,

    _init: function (orientation, panel_height, instance_id) {

        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        // Styling the container like your image

        this._players = {};
        this._activePlayer = null;
        this._ownerChangedId = null;

        this._buildUi();
        this._loadDBus();
    },

    _buildUi() {
        // Main Container
        this.containerMain = new St.BoxLayout({ style_class: "music-container-main" });
        this.container = new St.BoxLayout({ style_class: "music-container", style: "" });
        this.containerMain.add_actor(this.container)
        this.container.set_height(30);

        this.stack = new St.Widget({
            layout_manager: new Clutter.BinLayout()
        });

        this.backgroundBox = new St.BoxLayout({
            style_class: "my-bg-box",
            x_expand: true,
            y_expand: true,
            opacity: 76, // This is 0.3 opacity (30% of 255)
            clip_to_allocation: true
        });

        this.backgroundBox.set_opacity(65);

        // 3. The Foreground Box (Normal)
        this.foregroundBox = new St.BoxLayout({
            style_class: "my-fg-box",
            x_expand: true,
            y_expand: true,
            vertical: false
        });

        this.stack.add_actor(this.backgroundBox);
        this.stack.add_actor(this.foregroundBox);

        // 1. Cover Art (Icon for now)
        // this.coverArtBin = new St.BoxLayout({ width:34, height:34,style_class: "cover-art-bin", clip_to_allocation: true });
        let cover_path = "./assets/standby_cover.png";
        this.coverArtBin = new St.BoxLayout({
            style_class: "cover-art-bin",
            style: `background-image: url("${cover_path}");  background-size: cover;`,
            width: 30,
            height: 30,
            vertical: false,
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE
        });
        //this.coverArtBin.set_alignment(St.Align.MIDDLE, St.Align.MIDDLE);
        this.coverArt = new St.Icon({ icon_name: "firefox", icon_size: 32, style_class: "cover-art", icon_type: St.IconType.FULLCOLOR });
        //this.coverArtBin.add_actor(this.coverArt);
        this.foregroundBox.add_actor(this.coverArtBin);

        // 2. Text Info (Title & Artist)
        let textContainer = new St.BoxLayout({ clip_to_allocation: true,vertical: true, x_align: St.Align.START, style_class: "text-box", width: 100 });
        this.titleLabel = new St.Label({ text: "Song Title", style_class: "title-label" });
        this.artistLabel = new St.Label({ text: "Artist", x_align: St.Align.START, style_class: "artist-label" });
        textContainer.add_actor(this.titleLabel);
        textContainer.add_actor(this.artistLabel);
        this.foregroundBox.add_actor(textContainer);

        // 3. Controls
        this.controls = new St.BoxLayout({ style_class: "controls-box", vertical: true });
        this.btnPlay = new St.Button({ style_class: "controls-box-playbtn",child: new St.Icon({ icon_name: "media-playback-start", icon_size: 16, icon_type: St.IconType.SYMBOLIC, height: 9, width: 32 }) });
        this.btnPlay.connect("clicked", () => this._buttonAction("playPause"));

        this.playCont = new St.BoxLayout({ style_class: "controls-box-play" });

        this.prevNextCont = new St.BoxLayout({ style_class: "controls-box-prevnext" });
        this.btnPrev = new St.Button({ child: new St.Icon({ icon_name: "media-skip-backward", icon_size: 16, icon_type: St.IconType.SYMBOLIC, height: 10, width: 13 }) });
        this.btnNext = new St.Button({ child: new St.Icon({ icon_name: "media-skip-forward", icon_size: 16, icon_type: St.IconType.SYMBOLIC, height: 10, width: 13 }) });
        this.btnPrev.connect("clicked", () => this._buttonAction("previous"));
        this.btnNext.connect("clicked", () => this._buttonAction("next"));

        this.playCont.add_actor(this.btnPlay)
        this.prevNextCont.add_actor(this.btnPrev)
        this.prevNextCont.add_actor(this.btnNext)

        this.controls.add_actor(this.playCont);
        this.controls.add_actor(this.prevNextCont);
        this.foregroundBox.add_actor(this.controls);

        this.container.add_actor(this.stack);

        this.actor.add_actor(this.containerMain);
        this.actor.add_style_class_name("my-custom-music-applet");
        this.actor.set_style("border-image:none; border:0;");
    },

    _buttonAction(action) {
        if (this._activePlayer) {
            let timeout = false;
            switch (action) {
                case "playPause":
                    this._activePlayer.mediaServerPlayer.PlayPauseRemote();
                    timeout = true;
                    break;
                case "next":
                    this._activePlayer.mediaServerPlayer.NextRemote();
                    timeout = true;
                    break;
                case "previous":
                    this._activePlayer.mediaServerPlayer.PreviousRemote();
                    timeout = true;
                    break;
                default:
                    break;
            }

            if (timeout) {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                    this._updateUi();
                    return GLib.SOURCE_REMOVE;
                });
            }
        }
    },

    _updateUi() {
        try {
            if (this._activePlayer) {
                //this.playerIcon.icon_name = this._activePlayer.appIcon;

                if (this._activePlayer.isPlaying) {
                    this.btnPlay.child.icon_name = "media-playback-pause-symbolic";
                } else {
                    this.btnPlay.child.icon_name = "media-playback-start-symbolic";
                }

                let songDescription = this._activePlayer.songTitle;
                if (this._activePlayer.songArtist.length > 0) {
                    songDescription += songDescription.length > 0 ? " - " : "";
                    songDescription += this._activePlayer.songArtist;
                }

                this.titleLabel.set_text(this._activePlayer.songTitle);
                this.artistLabel.set_text(this._activePlayer.songArtist);
                this._updateCoverImage(this._activePlayer.artUrl);
            } else {
                //this.playerIcon.icon_name = "multimedia-audio-player-symbolic";
                //this.playPauseButton.child.icon_name = "media-playback-start-symbolic";
                this.artistLabel.set_text(this._activePlayer.songArtist);
                this._updateCoverImage("./assets/standby_cover.png");
            }
        } catch (e) {
            global.logError(e);
            throw e;
        }
    },

    _updateCoverImage(coverfilepath) {
        //Main.notify(coverfilepath)
        global.log(`activePlayer: ${JSON.stringify(this._activePlayer, null, 4)}`)
        if(this._activePlayer.mediaServer.Identity=="Marble Music Player") {
            let [success, stdout] = GLib.spawn_command_line_sync('bash -c "ls -1 /tmp/marble_$(whoami)_albumcovernowplaying_*.jpg" | sort | tail -n 1');
            //coverfilepath="file:///tmp/marble_janko_albumcovernowplaying.jpg";
            if (success && stdout.toString().trim() !== "") {
                coverfilepath = "file://" + stdout.toString().trim();
            }
        }
        if (coverfilepath) {
            let cover_path = "";
            if (coverfilepath.match(/^http/)) {
                if (!this._trackCoverFileTmp)
                    this._trackCoverFileTmp = `/tmp/mediaplayer-${Date.now().png}`;
                global.log(`preparing tmp: ${this._trackCoverFileTmp}`,['wget', '-q', this._trackCoverFile, '-O', this._trackCoverFileTmp])
                let argv = ['wget', '-q', coverfilepath, '-O', this._trackCoverFileTmp];

                let [success, pid] = GLib.spawn_async(
                    null, 
                    argv, 
                    null, 
                    GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, 
                    null
                );

                if (success) {
                    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status) => {
                        GLib.spawn_close_pid(pid);

                        if (status === 0) {
                            global.log(`downloaded: ${coverfilepath}`)
                            let cover_path = this._trackCoverFileTmp;
                            this._showCover(cover_path);
                            global.log(`cover applied!: ${cover_path}`)
                        } else {
                            global.logError(`wget failed with status: ${status}`);
                        }
                    });
                }
            }
            else if (coverfilepath.match(/data:image\/(png|jpeg);base64,/)) {
                if (!this._trackCoverFileTmp)
                    this._trackCoverFileTmp = Gio.file_new_tmp('XXXXXX.mediaplayer-cover')[0];
                const cover_base64 = this._trackCoverFile.split(',')[1];
                const base64_decode = data => new Promise(resolve => resolve(GLib.base64_decode(data)));
                if (!cover_base64) {
                    return;
                }
                base64_decode(cover_base64)
                    .then(decoded => {
                        this._trackCoverFileTmp.replace_contents(
                            decoded,
                            null,
                            false,
                            Gio.FileCreateFlags.REPLACE_DESTINATION,
                            null
                        );
                        return this._trackCoverFileTmp.get_path();
                    })
                    .then(path => this._showCover(path));
            }
            else {
                cover_path = decodeURIComponent(coverfilepath);
                cover_path = cover_path.replace("file://", "");
                this._showCover(cover_path);
            }
        }
        else
            this._showCover(false);
    },

    _showCover(cover_path) {
        global.log(`cover_path: ${cover_path}`);
        if (!cover_path || !GLib.file_test(cover_path, GLib.FileTest.EXISTS)) {
            this.coverArt = new St.Icon({ style_class: 'sound-player-generic-coverart', important: true, icon_name: "media-optical", icon_size: 32, icon_type: St.IconType.FULLCOLOR });
            cover_path = null;
        }
        else {
            this._cover_path = cover_path;
            let fileObject = Gio.file_new_for_path(cover_path);
            let iconData = Gio.FileIcon.new(fileObject);
            this.coverArt.gicon = iconData;
            this.coverArtBin.set_style(`background-image: url("${Gio.file_new_for_path(cover_path).get_uri()}");  background-size: cover;`);
            this.backgroundBox.set_style(`background-image: url("${Gio.file_new_for_path(cover_path).get_uri()}");  background-size: cover;`);
        }
    },

    _on_cover_loaded(cache, handle, actor) {
        // if (handle !== this._cover_load_handle) {
        //     // Maybe a cover image load stalled? Make sure our requests match the callback.
        //     return;
        // }

        //this.coverBox.remove_actor(this.cover);

        // Make sure any oddly-shaped album art doesn't affect the height of the applet popup
        // (and move the player controls as a result).
        // actor.margin_bottom = 300 - actor.height;

        // this.cover = actor;
        // this.coverBox.add_actor(this.cover);
        // this.coverBox.set_child_below_sibling(this.cover, this.trackInfo);
        // this._applet.setAppletTextIcon(this, this._cover_path);
    },

    _loadDBus() {
        Interfaces.getDBusAsync((proxy, error) => {
            if (error) {
                global.log(error);
                throw error;
            }

            this._dbus = proxy;

            let nameRegex = /^org\.mpris\.MediaPlayer2\./;

            this._dbus.ListNamesRemote((names) => {
                for (let n in names[0]) {
                    let name = names[0][n];
                    if (nameRegex.test(name)) {
                        this._dbus.GetNameOwnerRemote(name, (owner) => {
                            this._addPlayer(name, owner[0], true);
                        });
                    }
                }
            });

            this._ownerChangedId = this._dbus.connectSignal('NameOwnerChanged',
                (proxy, sender, [name, oldOwner, newOwner]) => {
                    if (nameRegex.test(name)) {
                        if (newOwner && !oldOwner) {
                            this._addPlayer(name, newOwner, true);
                        } else if (oldOwner && !newOwner) {
                            this._removePlayer(name);
                        } else {
                            this._updatePlayerOwner(name, newOwner);
                        }
                    }
                }
            );
        });
    },

    _addPlayer(name, ownerId, switchTo = false) {
        try {
            let player = new MediaPlayer(name, () => { this._updateUi() });
            //let menuItem = player.menuItem;

            // menuItem.activate = () => {
            //     this._switchPlayer(player);
            //     //this.menu.toggle();
            // };

            this._players[name] = { player, ownerId }
            //this.menu.addMenuItem(menuItem);

            if (switchTo) {
                this._switchPlayer(player);
            }
        } catch (e) {
            global.logError(e);
            throw e;
        }
    },

    _removePlayer(name) {
        try {
            if (!this._players[name]) {
                return;
            }

            let player = this._players[name].player;

            if (this._activePlayer == player) {
                let allPlayers = Object.keys(this._players);
                if (allPlayers.length > 1) {
                    let newPlayerName = allPlayers[allPlayers.length - 1];
                    this._switchPlayer(this._players[newPlayerName].player);
                } else {
                    this._switchPlayer(null);
                }
            }

            player.destroy();
            delete this._players[name];
        } catch (e) {
            global.logError(e);
            throw e;
        }
    },

    _updatePlayerOwner(name, ownerId) {
        this._players[name].ownerId = ownerId;
    },

    _switchPlayer(player) {
        try {
            Object.keys(this._players).forEach(key => {
                //this._players[key].player.menuItem.setShowDot(false);
            });

            this._activePlayer = player;

            if (this._activePlayer !== null) {
                //this._activePlayer.menuItem.setShowDot(true);
            }

            this._updateUi();
        } catch (e) {
            global.logError(e);
            throw e;
        }
    },

    on_applet_clicked(event) {
        //this.menu.toggle();
    },

    on_applet_removed_from_panel() {
        Object.values(this._players).forEach((p) => {
            p.player.destroy();
        });

        if (this._dbus && this._ownerChangedId) {
            this._dbus.disconnectSignal(this._ownerChangedId);
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}
