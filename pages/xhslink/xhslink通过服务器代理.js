Page({
  data: {
    inputValue: '',
    link: '',
    apiResult: null,
    loading: false
  },
  
  // 添加链接转换方法
  convertImageUrl(url) {
    if (!url) return url;
    // 将原始链接转换为通过你的服务器代理的HTTPS链接
    return `https://xhs-service.xgbb.xyz/proxy-image?url=${encodeURIComponent(url)}`;
  },
  
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },
  
  onParse() {
    const reg = /(https?:\/\/xhslink\.com\/[\w\/-]+)/i;
    const match = this.data.inputValue.match(reg);
    
    if (match) {
      const link = match[1];
      this.setData({ link, loading: true, apiResult: null });
      
      wx.request({
        url: `https://api.mu-jie.cc/xhs`,
        method: 'GET',
        data: { url: link },
        success: (res) => {
          console.log('接口响应成功:', res);
          
          // 处理返回的数据，转换图片链接
          if (res.data && res.data.data) {
            // 转换封面图片链接
            if (res.data.data.cover) {
              res.data.data.cover = this.convertImageUrl(res.data.data.cover);
            }
            
            // 转换图片数组中的链接
            if (res.data.data.images && Array.isArray(res.data.data.images)) {
              res.data.data.images = res.data.data.images.map(img => this.convertImageUrl(img));
            }
          }
          
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
  
  // 其他方法保持不变...
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
