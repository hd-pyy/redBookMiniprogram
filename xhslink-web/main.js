new Vue({
  el: '#app',
  data() {
    return {
      inputValue: '',
      link: '',
      apiResult: null,
      loading: false
    };
  },
  methods: {
    extractLink() {
      // 匹配 http(s)://xhslink.com/任意路径/xxx
      const reg = /(https?:\/\/xhslink\.com\/[\w\/-]+)/i;
      const match = this.inputValue.match(reg);
      this.link = match ? match[1] : '';
    },
    async onParse() {
      this.extractLink();
      if (!this.link) {
        this.apiResult = null;
        this.$toast('未提取到链接', 1000, 'error');
        return;
      }
      this.loading = true;
      try {
        const res = await fetch(`https://api.mu-jie.cc/xhs?url=${encodeURIComponent(this.link)}`);
        const data = await res.json();
        this.apiResult = data;
        if (data && data.code === -4) {
          this.$toast('当前接口请求频率过高，或服务器IP已被封禁，请稍后重试！', 1000, 'error');
        } else {
          this.$toast('解析成功', 500, 'success');
        }
      } catch (e) {
        this.apiResult = null;
        this.$toast('请求失败', 1000, 'error');
      }
      this.loading = false;
    },
    downloadImage(url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    downloadAllImages() {
      if (!this.apiResult || !this.apiResult.data || !this.apiResult.data.images) return;
      this.apiResult.data.images.forEach(url => this.downloadImage(url));
      this.$toast('全部下载已触发', 800, 'success');
    },
    $toast(msg, duration = 1000, type = 'success') {
      // 简易toast
      const toast = document.createElement('div');
      toast.textContent = msg;
      toast.style.position = 'fixed';
      toast.style.left = '50%';
      toast.style.top = '40%';
      toast.style.transform = 'translate(-50%, -50%)';
      toast.style.background = type === 'success' ? '#323232' : '#d81e3a';
      toast.style.color = '#fff';
      toast.style.padding = '14px 28px';
      toast.style.borderRadius = '8px';
      toast.style.fontSize = '1.1rem';
      toast.style.zIndex = 9999;
      document.body.appendChild(toast);
      setTimeout(() => {
        document.body.removeChild(toast);
      }, duration);
    }
  },
  template: `
    <div>
      <div class="title">小红书链接解析</div>
      <div class="input-area">
        <textarea v-model="inputValue" placeholder="请粘贴小红书分享内容"></textarea>
        <button @click="onParse" :disabled="loading">{{ loading ? '解析中...' : '提取并解析' }}</button>
      </div>
      <div class="result" v-if="link">
        <b>提取到的链接：</b>
        <span style="color:#ff2442">{{ link }}</span>
      </div>
      <div class="result" v-if="apiResult">
        <b>接口返回：</b>
        <pre style="background:#f5f5f5;padding:10px;border-radius:6px;overflow:auto;">{{ JSON.stringify(apiResult, null, 2) }}</pre>
      </div>
      <div class="result" v-if="apiResult && apiResult.data && apiResult.data.images && apiResult.data.images.length">
        <div style="font-weight:bold;margin-bottom:8px;">图片预览：</div>
        <button @click="downloadAllImages" style="margin-bottom:12px;">一键下载全部图片</button>
        <div class="images">
          <div class="img-item" v-for="(img, idx) in apiResult.data.images" :key="idx">
            <img :src="img" />
            <button @click="downloadImage(img)">下载</button>
          </div>
        </div>
      </div>
    </div>
  `
});
