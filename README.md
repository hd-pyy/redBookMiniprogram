[readme.md](https://github.com/user-attachments/files/22057820/readme.md)


# 微信小程序端

```java
Page({
  data: {
    inputValue: '',
    link: '',
    apiResult: null,
    loading: false
  },
  
  // 通过服务器进行代理下载核心代码
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
  onLoad(options) {
    // 兼容 navigateTo 传参（非 tabBar）
    if (options && options.content) {
      const content = decodeURIComponent(options.content);
      this.setData({ inputValue: content });
      setTimeout(() => {
        this.onParse();
      }, 100);
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
  },
  
  onClear() {
    this.setData({
      inputValue: '',
      link: '',
      apiResult: null
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
          // 存储历史记录
          if (this.data.inputValue) {
            let history = wx.getStorageSync('xhs_history') || [];
            if (!history.includes(this.data.inputValue)) {
              history.unshift(this.data.inputValue);
              if (history.length > 50) history = history.slice(0, 50);
              wx.setStorageSync('xhs_history', history);
            }
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

```



# 服务器代理

由于微信小程序不能直接从http中下载文件，因此需要一台服务器通过https域名做反向代理

## 1. 环境准备z

首先确保你的服务器已安装 Node.js：

```
bash复制# 检查是否已安装
node --version
npm --version

# 如果未安装，可以通过以下方式安装（Ubuntu/Debian）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 2. 创建项目

在你的服务器上创建项目目录：

```
mkdir wechat-image-proxy
cd wechat-image-proxy
```

## 3. 初始化项目并安装依赖

```
# 初始化 package.json
npm init -y

# 安装 Express
npm install express

# 可选：安装 PM2 用于进程管理
npm install -g pm2
```

## 4. 创建服务器文件

创建 `server.js` 文件：

```


const express = require('express');
const https = require('https');
const http = require('http');
const url = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// 添加 CORS 支持（如果需要）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// 图片代理接口
app.get('/proxy-image', (req, res) => {
  const imageUrl = req.query.url;
  
  if (!imageUrl) {
    return res.status(400).json({ error: '缺少图片URL参数' });
  }

  console.log('代理请求图片:', imageUrl);

  // 判断使用http还是https
  const client = imageUrl.startsWith('https://') ? https : http;
  
  const options = url.parse(imageUrl);
  options.headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  client.get(options, (response) => {
    // 检查响应状态
    if (response.statusCode !== 200) {
      return res.status(response.statusCode).json({ 
        error: `图片请求失败，状态码: ${response.statusCode}` 
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    
    // 设置缓存头（可选）
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // 将图片数据流式传输给客户端
    response.pipe(res);
    
  }).on('error', (err) => {
    console.error('代理请求失败:', err);
    res.status(500).json({ error: '图片获取失败' });
  });

  // 设置请求超时
  req.setTimeout(30000, () => {
    res.status(504).json({ error: '请求超时' });
  });
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`图片代理服务器运行在端口 ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

```

## 5. 运行服务器

### 开发环境测试：

```
node server.js
```

### 生产环境（推荐使用 PM2）：

```
# 使用 PM2 启动
pm2 start server.js --name "image-proxy"

# 查看运行状态
pm2 status

# 查看日志
pm2 logs image-proxy

# 停止服务
pm2 stop image-proxy

# 重启服务
pm2 restart image-proxy
```



## 6.反向代理

在宝塔实现
