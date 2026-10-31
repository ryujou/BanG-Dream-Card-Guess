window.EVENT_LOADING = 'minigame-loading';
      window.EVENT_STARTED = 'minigame-started';

      ;(function () {
        var splash = document.getElementById('splash');
        var progressBar = splash && splash.querySelector('.progress-rate');
        var progressText = splash && splash.querySelector('.progress-text');
        // var progressSuffix =  splash && splash.querySelector('.progress-suffix');

        // 真实进度 & 假进度
        var realPercent = 0;
        var fakePercent = 0;
        var finished = false;
        var fakeTimer = null;
        var MAX_FAKE = 90; // 没有真实进度时，假进度最多到 90%

        function setProgress(p) {
          if (!progressBar) return;
          p = Math.max(0, Math.min(100, p));
          progressBar.style.width = p.toFixed(2) + '%';
          // progressSuffix.style.left = p.toFixed(2) + '%';
          if (splash) {
            splash.style.display = 'flex';
          }
        }

        // 启动一个持续运行的“假进度”
        function startFakeProgress() {
          if (fakeTimer || !progressBar) return;
          fakeTimer = setInterval(function () {
            if (finished) return;

            // 越靠近 100% 速度越慢一点，看起来更自然
            var speed = (100 - fakePercent) * 0.06 + 0.6; // 可根据体验微调
            fakePercent = Math.min(fakePercent + speed, MAX_FAKE);

            var display = Math.max(fakePercent, realPercent);
            setProgress(display);
          }, 100); 
        }

        startFakeProgress();

        window.addEventListener(EVENT_LOADING, function (e) {
          if (!progressBar || !e || !e.detail) return;

          var finishedCount = e.detail.finished || 0;
          var total = e.detail.total || 1;
          realPercent = Math.min(100, (100 * finishedCount) / total);

          var display = Math.max(fakePercent, realPercent);
          setProgress(display);
        });

        window.addEventListener(EVENT_STARTED, function () {
         finished = true;
          realPercent = 100;
          setProgress(100);

          if (fakeTimer) {
            clearInterval(fakeTimer);
            fakeTimer = null;
          }

          setTimeout(function () {
            if (splash) splash.style.display = 'none';
          }, 300);
        });
      })();
