const config = require('../../config');

function jsonFormat(obj) {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return '';
    }
  }
  
  Page({
    data: {
      inputValue: '',
      link: '',
      apiResult: null,
      loading: false,
      downloadProgress: 0,
      isDownloading: false,
      downloadedSize: 0,
      totalSize: 0,
      downloadSpeed: 0
    },
  
    convertImageUrl(url) {
      if (!url) return url;
      return `${config.proxyImageUrl}?url=${encodeURIComponent(url)}`;
    },
  
    convertVideoUrl(url) {
      if (!url) return url;
      return `${config.proxyVideoUrl}?url=${encodeURIComponent(url)}`;
    },
  
    onInput(e) {
      this.setData({
        inputValue: e.detail.value
      });
    },
  
    onClear() {
      this.setData({
        inputValue: '',
        link: '',
        apiResult: null,
        loading: false,
        downloadProgress: 0,
        isDownloading: false,
        downloadedSize: 0,
        totalSize: 0,
        downloadSpeed: 0
      });
    },
  
    onParse() {
      const reg = /(https?:\/\/xhslink\.com\/[\w\/-]+)/i;
      const match = this.data.inputValue.match(reg);
      
      if (match) {
        const link = match[1];
        this.setData({ link, loading: true, apiResult: null });
        
        wx.request({
          url: config.xhsApiUrl,
          method: 'GET',
          data: { url: link },
          success: (res) => {
            console.log('接口响应成功:', res);
            
            if (res.data && res.data.data) {
              if (res.data.data.cover) {
                res.data.data.cover = this.convertImageUrl(res.data.data.cover);
              }
              
              if (res.data.data.type === '图文' && res.data.data.images) {
                res.data.data.images = res.data.data.images.map(img => this.convertImageUrl(img));
              } else if (res.data.data.type === '视频' && res.data.data.url) {
                res.data.data.url = this.convertVideoUrl(res.data.data.url);
              }
            }
            
            this.setData({ apiResult: res.data, loading: false });
            // 存储历史记录
            if (this.data.inputValue) {
              let history = wx.getStorageSync('xhs_history') || [];
              if (!history.includes(this.data.inputValue)) {
                history.unshift(this.data.inputValue);
                if (history.length > 50) history = history.slice(0, 50);
                wx.setStorageSync('xhs_history', history);
              }
            }
            if (res.data && res.data.code === -4) {
              wx.showToast({
                title: '当前接口请求频率过高，或服务器IP已被封禁，请稍后重试！',
                icon: 'none',
                duration: 1000
              });
            } else {
              wx.showToast({
                title: '解析成功',
                icon: 'success',
                duration: 500
              });
            }
          },
          fail: (err) => {
            console.error('接口请求失败:', err);
            this.setData({ apiResult: { error: '请求失败' }, loading: false });
          }
        });
      } else {
        this.setData({ link: '未提取到链接', apiResult: null });
      }
    },
  
    onShow() {
      // 兼容 tabBar switchTab 传值
      const content = wx.getStorageSync('xhslink_content');
      if (content) {
        this.setData({ inputValue: content });
        setTimeout(() => {
          this.onParse();
          wx.removeStorageSync('xhslink_content');
        }, 100);
      }
      if (typeof wx !== 'undefined' && wx && wx.nextTick) {
        wx.nextTick(() => {
          if (!this.jsonFormatRegistered) {
            this.jsonFormatRegistered = true;
            this.setData({});
          }
        });
      }
    },
  
    onLoad(options) {
      if (options && options.content) {
        const content = decodeURIComponent(options.content);
        this.setData({ inputValue: content });
      }
    },
  
    jsonFormat,
  
    onDownloadImage(e) {
      const url = e.currentTarget.dataset.url;
      if (!url) return;
      this._downloadAndSaveImage(url);
    },
  
    async onDownloadAllImages() {
      const images = (this.data.apiResult && this.data.apiResult.data && this.data.apiResult.data.images) || [];
      if (!images.length) {
        wx.showToast({ title: '无图片可下载', icon: 'none' });
        return;
      }
      wx.showLoading({ title: '下载中...' });
      for (let i = 0; i < images.length; i++) {
        await this._downloadAndSaveImage(images[i], true);
      }
      wx.hideLoading();
      wx.showToast({ title: '全部下载完成', icon: 'success' });
    },
  
    onDownloadVideo() {
      const videoUrl = this.data.apiResult && this.data.apiResult.data && this.data.apiResult.data.url;
      if (!videoUrl) {
        wx.showToast({ title: '无视频可下载', icon: 'none' });
        return;
      }
      this._downloadAndSaveVideo(videoUrl);
    },
  
    onCancelDownload() {
      if (this.downloadTask) {
        this.downloadTask.abort();
        this.setData({ 
          isDownloading: false, 
          downloadProgress: 0,
          downloadedSize: 0,
          totalSize: 0,
          downloadSpeed: 0
        });
        wx.showToast({ title: '下载已取消', icon: 'none' });
      }
    },
  
    onPreviewVideo() {
      const videoUrl = this.data.apiResult && this.data.apiResult.data && this.data.apiResult.data.url;
      if (!videoUrl) {
        wx.showToast({ title: '无视频可预览', icon: 'none' });
        return;
      }
      
      wx.previewMedia({
        sources: [{
          url: videoUrl,
          type: 'video'
        }],
        current: 0
      });
    },
  
    _requestAlbumPermission() {
      return new Promise((resolve) => {
        wx.getSetting({
          success: (res) => {
            if (res.authSetting['scope.writePhotosAlbum'] === false) {
              wx.showModal({
                title: '需要相册权限',
                content: '保存图片/视频需要访问你的相册，请在设置中授予权限',
                confirmText: '去授权',
                success: (res) => {
                  if (res.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        if (settingRes.authSetting['scope.writePhotosAlbum']) {
                          resolve(true);
                        } else {
                          wx.showToast({ title: '用户拒绝了相册权限', icon: 'none' });
                          resolve(false);
                        }
                      },
                      fail: () => resolve(false)
                    });
                  } else {
                    resolve(false);
                  }
                }
              });
            } else if (res.authSetting['scope.writePhotosAlbum'] === true) {
              resolve(true);
            } else {
              resolve(true);
            }
          },
          fail: () => resolve(true)
        });
      });
    },

    _downloadAndSaveImage(url, silent) {
      return new Promise((resolve) => {
        const downloadAndSave = () => {
          wx.downloadFile({
            url,
            success: (res) => {
              if (res.statusCode === 200) {
                wx.saveImageToPhotosAlbum({
                  filePath: res.tempFilePath,
                  success: () => {
                    if (!silent) wx.showToast({ title: '保存成功', icon: 'success' });
                    resolve();
                  },
                  fail: (err) => {
                    console.error('保存图片失败', err);
                    if (!silent) {
                      wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' });
                    }
                    resolve();
                  }
                });
              } else {
                if (!silent) wx.showToast({ title: '下载失败，状态码: ' + res.statusCode, icon: 'none' });
                console.error('下载失败，状态码:', res.statusCode);
                resolve();
              }
            },
            fail: (err) => {
              if (!silent) wx.showToast({ title: '下载失败: ' + (err.errMsg || '网络错误'), icon: 'none' });
              console.error('下载失败:', err);
              resolve();
            }
          });
        };

        if (!this.albumPermissionRequested) {
          this.albumPermissionRequested = true;
          this._requestAlbumPermission().then((hasPermission) => {
            if (hasPermission) {
              downloadAndSave();
            } else {
              resolve();
            }
          });
        } else {
          downloadAndSave();
        }
      });
    },
  
    _downloadAndSaveVideo(url) {
      const startDownload = () => {
        this.setData({ 
          isDownloading: true, 
          downloadProgress: 0,
          downloadedSize: 0,
          totalSize: 0,
          downloadSpeed: 0
        });
        
        let startTime = Date.now();
        let retryCount = 0;
        const maxRetries = 2;
        
        const attemptDownload = () => {
          this.downloadTask = wx.downloadFile({
            url,
            timeout: 300000,
            success: (res) => {
              this.setData({ 
                isDownloading: false,
                downloadProgress: 0,
                downloadedSize: 0,
                totalSize: 0,
                downloadSpeed: 0
              });
              
              if (res.statusCode === 200) {
                wx.saveVideoToPhotosAlbum({
                  filePath: res.tempFilePath,
                  success: () => {
                    wx.showToast({ title: '视频保存成功', icon: 'success' });
                  },
                  fail: (err) => {
                    console.error('保存视频失败', err);
                    wx.showToast({ title: '保存视频失败，请检查相册权限', icon: 'none' });
                  }
                });
              } else {
                wx.showToast({ title: '视频下载失败，状态码: ' + res.statusCode, icon: 'none' });
                console.error('视频下载失败，状态码:', res.statusCode);
              }
            },
            fail: (err) => {
              console.error('下载失败:', err);
              
              if (retryCount < maxRetries) {
                retryCount++;
                wx.showToast({ 
                  title: `下载失败，正在重试 ${retryCount}/${maxRetries}`, 
                  icon: 'none' 
                });
                setTimeout(() => attemptDownload(), 3000);
                return;
              }
              
              this.setData({ 
                isDownloading: false,
                downloadProgress: 0,
                downloadedSize: 0,
                totalSize: 0,
                downloadSpeed: 0
              });
              wx.showToast({ title: '下载失败: ' + (err.errMsg || '网络错误'), icon: 'none' });
            }
          });
    
          this.downloadTask.onProgressUpdate((res) => {
            const currentTime = Date.now();
            const elapsedTime = (currentTime - startTime) / 1000;
            const speed = elapsedTime > 0 ? (res.bytesWritten || 0) / elapsedTime : 0;
            
            this.setData({
              downloadProgress: res.progress || 0,
              downloadedSize: res.bytesWritten || 0,
              totalSize: res.totalBytesExpectedToWrite || 0,
              downloadSpeed: speed
            });
          });
        };
    
        attemptDownload();
      };

      // 检查权限
      this._requestAlbumPermission().then((hasPermission) => {
        if (hasPermission) {
          startDownload();
        }
      });
    }
  });
  