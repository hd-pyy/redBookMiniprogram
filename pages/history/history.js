Page({
  data: {
    historyList: []
  },
  onShow() {
    const list = wx.getStorageSync('xhs_history') || [];
    this.setData({ historyList: list });
  },
  onItemTap(e) {
    const content = e.currentTarget.dataset.content;
    console.log("content",content);

    wx.navigateTo({
      url: '/pages/xhslink/xhslink?content=' + encodeURIComponent(content)
    });
  },
  onItemParse(e) {
    const content = e.currentTarget.dataset.content;
    wx.setStorageSync('xhslink_content', content);
    wx.switchTab({
      url: '/pages/xhslink/xhslink'
    });
  }
});
