"use client";
import React, { useState, useEffect } from "react";

export default function AIExtractPage() {
  const [file, setFile] = useState<File | null>(null);
  const [taskId, setTaskId] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [polling, setPolling] = useState(false);

  // 上传PDF并启动AI提取
  const handleUpload = async () => {
    if (!file) {
      setMessage("请先选择PDF文件");
      return;
    }
    setMessage("上传中...");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/extract/start", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.task_id) {
      setTaskId(data.task_id);
      setMessage("上传成功，任务已启动: " + data.task_id);
      setPolling(true);
      setStatus(null);
      setResult(null);
    } else {
      setMessage(data.error || "上传失败");
    }
  };

  // 轮询进度
  useEffect(() => {
    if (!taskId || !polling) return;
    let timer: NodeJS.Timeout;
    const fetchStatus = async () => {
      const res = await fetch(`/api/extract/status/${taskId}`);
      const data = await res.json();
      setStatus(data);
      if (data.status === "done") {
        setPolling(false);
        // 获取最终结果
        const res2 = await fetch(`/api/extract/result/${taskId}`);
        setResult(await res2.json());
      } else if (data.status === "error") {
        setPolling(false);
      } else {
        timer = setTimeout(fetchStatus, 2000);
      }
    };
    fetchStatus();
    return () => timer && clearTimeout(timer);
  }, [taskId, polling]);

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 24, border: "1px solid #eee", borderRadius: 8 }}>
      <h2>AI 智能工程图纸内容提取</h2>
      <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleUpload} style={{ marginLeft: 8 }}>上传并提取</button>
      <div style={{ margin: "16px 0", color: '#0070f3' }}>{message}</div>
      {status && (
        <div style={{ marginTop: 24 }}>
          <h4>任务状态</h4>
          <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 4 }}>{JSON.stringify(status, null, 2)}</pre>
        </div>
      )}
      {result && (
        <div style={{ marginTop: 24 }}>
          <h4>结构化提取结果</h4>
          <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 4, maxHeight: 400, overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
} 