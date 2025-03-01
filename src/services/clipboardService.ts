export class ClipboardService {
    copyToClipboard(text: string): void {
      if (navigator.clipboard && window.isSecureContext) {
        // API method
        navigator.clipboard.writeText(text).then(() => {
          console.log("文本已成功复制到剪贴板");
        }).catch(err => {
          console.error("无法复制文本: ", err);
        });
      } else {
        // Fallback method
        let textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";  // Avoid scrolling to bottom
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          let successful = document.execCommand('copy');
          let msg = successful ? '成功' : '失败';
          console.log('后备方案: 复制文本' + msg);
        } catch (err) {
          console.error('后备方案: 无法复制文本', err);
        }
        document.body.removeChild(textArea);
      }
    }
  }