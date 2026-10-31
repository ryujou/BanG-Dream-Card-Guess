document.documentElement.classList.toggle("mooncake-embedded", window.parent !== window);
window.IS_MOBILE = /Android|webOS|iPhone|iPod|iPad|BlackBerry|IEMobile|Mobile|Mobi/i.test(navigator.userAgent)
      window.IS_HARMONY = /harmony/ig.test(navigator.userAgent) || /android/i.test(navigator.userAgent)
;
;(function () {
        var m = navigator.userAgent.match(/Android (\d+)/)
        window.LESS_ANDROID_10 = m ? parseInt(m[1], 10) < 10 : false
        console.log('LESS_ANDROID_10:', window.LESS_ANDROID_10)
      })()
;
// 用于显示pv按钮
      window.PV_URL = ''
;
window.dataLayer = window.dataLayer || []
      function gtag() {
        dataLayer.push(arguments)
      }
      gtag('js', new Date())
      gtag('config', 'G-EXSE9ZVYTH')
