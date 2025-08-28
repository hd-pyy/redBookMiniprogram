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
    // 正则提取 http(s)://xhslink.com/n/xxxx 形式的链接
    const reg = /(https?:\/\/xhslink\.com\/n\/[\w\-]+)/i;
    const match = this.data.inputValue.match(reg);
    if (match) {
      const link = match[1];
      this.setData({ link, loading: true, apiResult: null });
      wx.request({
        url: `https://api.mu-jie.cc/xhs`,
        method: 'GET',
        data: { url: link },
        success: (res) => {
          this.setData({ apiResult: res.data, loading: false });
        },
        fail: (err) => {
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
  jsonFormat
});
