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
    loading: false
  },
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },
  onParse() {
  // 正则提取 http(s)://xhslink.com/任意路径/xxxx 形式的链接
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
          this.setData({ apiResult: res.data, loading: false });
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
  // 小程序不支持 wxml 直接用 js 函数，需要在页面 onShow 时注册过滤器
  onShow() {
    if (typeof wx !== 'undefined' && wx && wx.nextTick) {
      wx.nextTick(() => {
        if (!this.jsonFormatRegistered) {
          this.jsonFormatRegistered = true;
          this.setData({}); // 触发视图刷新
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

  _downloadAndSaveImage(url, silent) {
    return new Promise((resolve) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200) {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                if (!silent) wx.showToast({ title: '保存成功', icon: 'success' });
                resolve();
              }
            });
          } else {
            if (!silent) wx.showToast({ title: '下载失败', icon: 'none' });
            resolve();
          }
        },
        fail: (err) => {
          if (!silent) wx.showToast({ title: '下载失败', icon: 'none' });
          console.error('下载失败', err);
          resolve();
        }
      });
    });
  }
});
