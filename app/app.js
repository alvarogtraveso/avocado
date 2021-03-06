import React from 'react';
import ReactDOM from 'react-dom';
import Dropzone from 'react-dropzone';
import VideoPlayer from './components/VideoPlayer/VideoPlayer'
import SplashView from './components/SplashView/SplashView'

import './../public/scss/style.scss'

const scanner = require('./lib/chromecast-scanner')();
const chromecastClient = require('./lib/chromecast-client')();

class App extends React.Component {

  constructor() {
    super();

    this.statusIntervalId;
    this.state = {
      connectedToChromecast: false,
      castingVideo: false,
      videoDuration: 0,
      videoCurrentTime: 0
    }
  }

  componentWillMount() {
    let self = this;
    // start scanning for chromecasts
    scanner.scan();
    scanner.on('found', function(host) {
      console.log('chromecast found: ' + host);
      chromecastClient.connect(host, function() {
        self.setState({connectedToChromecast: true});
      });

      // TODO this should be temporary
      scanner.stop();
    });

    chromecastClient.on('status', function(status){
      console.log('player state: %s', status.playerState);
      // this will happen when the video ends
      if(status.playerState === 'IDLE' && self.state.castingVideo){
        self._onStop();
      }
    });
  }

  _onDrop(acceptedFiles, rejectedFiles) {
    let self = this;

    let media = {};
    for (let file of acceptedFiles) {
      console.log('File(s) you dragged here: ', file.path);
      if (file.path.substr(-4).toLowerCase() === '.srt') {
        media.subtitles = file;
      } else {
        // TODO check if it's a valid video format
        media.video = file;
      }
    };

    if (media) {
      chromecastClient.start(media, function(status){
        self.setState({castingVideo: true, videoDuration: status.media.duration});
        self.statusIntervalId = setInterval(() => {
          chromecastClient.getStatus(function(err, status) {
            if(err) console.err(err);
            self.setState({videoCurrentTime: status.currentTime});
          });
        }, 1000);
      });
    }
  }

  _onResume() {
    chromecastClient.unpause();
  }

  _onPause() {
    chromecastClient.pause();
  }

  _onStop() {
    chromecastClient.stop();
    this.setState({castingVideo: false});
    window.clearInterval(this.statusIntervalId);
  }

  _onSeek(newCurrentTime){
    chromecastClient.seek(newCurrentTime);
  }

  _onVolumeChange(volumeValue) {
    chromecastClient.setVolume(volumeValue);
  }

  render() {
    let appRender;

    if (this.state.connectedToChromecast) {
      if (!this.state.castingVideo) {
        appRender = (
          <Dropzone
            className="drop-zone"
            onDrop={this._onDrop.bind(this)}>
            <div>Just drop some files here, or click to select files to cast.</div>
          </Dropzone>
        );
      } else {
        appRender = (
          <VideoPlayer
            playing={true}
            onPause={this._onPause.bind(this)}
            onResume={this._onResume.bind(this)}
            onStop={this._onStop.bind(this)}
            onSeek={this._onSeek.bind(this)}
            onVolumeChange={this._onVolumeChange.bind(this)}
            videoDuration={this.state.videoDuration}
            videoCurrentTime={this.state.videoCurrentTime}
          />
        );
      }
    } else {
      appRender = <SplashView />;
    }

    return (appRender);
  }
}

// Render to ID app in the DOM
ReactDOM.render(< App / >, document.getElementById('app'));
