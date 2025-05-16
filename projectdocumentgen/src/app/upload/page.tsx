"use client";
import React, { useState, useEffect } from "react";

export default function UploadPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [taskId, setTaskId] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<string>("");
  const [selectedPages, setSelectedPages] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [polling, setPolling] = useState(false);
  const [table, setTable] = useState<any>(null);
  const [previewFile, setPreviewFile] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  // 上传文件
  const handleUpload = async () => {
    if (!files || files.length === 0) {
      setMessage("请先选择文件");
      return;
    }
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    setMessage("上传中...");
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.task_id) {
      setTaskId(data.task_id);
      setMessage("上传成功，task_id: " + data.task_id);
      setHistory((prev) => [data.task_id, ...prev.filter(id => id !== data.task_id)].slice(0, 5));
      setUploadedFiles(Array.from(files).map(f => f.name));
    } else {
      setMessage(data.error || "上传失败");
    }
  };

  // 轮询任务状态
  useEffect(() => {
    if (!taskId || !polling) return;
    let timer: NodeJS.Timeout;
    const fetchStatus = async () => {
      const res = await fetch(`/api/status/${taskId}`);
      const data = await res.json();
      setStatus(data);
      if (data.status === "done") {
        setPolling(false);
        // 获取最终结果
        const res2 = await fetch(`/api/result/${taskId}`);
        setResult(await res2.json());
      } else if (data.status === "error") {
        setPolling(false);
      } else {
        timer = setTimeout(fetchStatus, 1000);
      }
    };
    fetchStatus();
    return () => timer && clearTimeout(timer);
  }, [taskId, polling]);

  // 发起处理任务
  const handleProcess = async () => {
    if (!taskId) {
      setMessage("请先上传文件");
      return;
    }
    setMessage("任务发起中...");
    setStatus(null);
    setResult(null);
    setPolling(true);
    const body = {
      task_id: taskId,
      selected_files: selectedFiles ? selectedFiles.split(",").map(f => f.trim()) : undefined,
      selected_pages: selectedPages ? selectedPages.split(",").map(p => Number(p.trim())) : undefined,
    };
    const res = await fetch("/api/process-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.message) {
      setMessage("任务已发起: " + data.task_id);
    } else {
      setMessage(data.error || "任务发起失败");
      setPolling(false);
    }
  };

  // 生成表格
  const handleGenerateTable = async () => {
    if (!taskId) {
      setMessage("请先上传并处理文件");
      return;
    }
    setMessage("生成表格中...");
    const res = await fetch(`/api/generate-table/${taskId}`);
    const data = await res.json();
    if (data.status === 'ok') {
      setTable(data);
      setMessage("表格生成成功");
    } else {
      setMessage(data.message || "表格生成失败");
    }
  };

  // 下载 Excel
  const handleDownloadExcel = () => {
    if (!taskId) return;
    window.open(`/api/download-table/${taskId}`);
  };

  // 下载 JSON
  const handleDownloadJson = () => {
    if (!taskId) return;
    window.open(`/api/download/${taskId}`);
  };

  // 预览图片
  const handlePreview = () => {
    if (!taskId || !previewFile) return;
    setPreviewUrl(`/api/preview/${encodeURIComponent(previewFile)}?task_id=${taskId}`);
  };

  // 切换历史 task_id
  const handleSelectHistory = (id: string) => {
    setTaskId(id);
    setMessage("已切换到历史任务: " + id);
    setStatus(null);
    setResult(null);
    setTable(null);
    setUploadedFiles([]);
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 24, border: "1px solid #eee", borderRadius: 8 }}>
      <h2>文件上传与任务发起</h2>
      <input type="file" multiple onChange={e => setFiles(e.target.files)} />
      <button onClick={handleUpload} style={{ marginLeft: 8 }}>上传</button>
      <div style={{ margin: '16px 0' }}>
        <div>task_id: <b>{taskId}</b></div>
        {history.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            历史任务：
            {history.map(id => (
              <button key={id} onClick={() => handleSelectHistory(id)} style={{ marginRight: 8, fontSize: 13 }}>{id}</button>
            ))}
          </div>
        )}
      </div>
      {uploadedFiles.length > 0 && (
        <div style={{ marginBottom: 8, fontSize: 13 }}>
          上传文件：{uploadedFiles.join(', ')}
        </div>
      )}
      <div>
        <label>选中文件名（逗号分隔）</label><br />
        <input value={selectedFiles} onChange={e => setSelectedFiles(e.target.value)} style={{ width: "100%" }} placeholder="如 file1.pdf, file2.png" />
      </div>
      <div style={{ marginTop: 8 }}>
        <label>选中页码（逗号分隔）</label><br />
        <input value={selectedPages} onChange={e => setSelectedPages(e.target.value)} style={{ width: "100%" }} placeholder="如 1, 2, 3" />
      </div>
      <button onClick={handleProcess} style={{ marginTop: 16 }}>发起处理任务</button>
      <div style={{ marginTop: 16, color: '#0070f3' }}>{message}</div>
      {status && (
        <div style={{ marginTop: 24 }}>
          <h4>任务状态</h4>
          <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 4 }}>{JSON.stringify(status, null, 2)}</pre>
        </div>
      )}
      {result && (
        <div style={{ marginTop: 24 }}>
          <h4>处理结果</h4>
          <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 4 }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      <div style={{ marginTop: 32 }}>
        <button onClick={handleGenerateTable} disabled={!taskId} style={{ marginRight: 8 }}>生成表格</button>
        <button onClick={handleDownloadExcel} disabled={!taskId} style={{ marginRight: 8 }}>下载Excel</button>
        <button onClick={handleDownloadJson} disabled={!taskId}>下载JSON</button>
      </div>
      {table && (
        <div style={{ marginTop: 24 }}>
          <h4>表格数据</h4>
          <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 4 }}>{JSON.stringify(table, null, 2)}</pre>
        </div>
      )}
      <div style={{ marginTop: 32, borderTop: '1px solid #eee', paddingTop: 24 }}>
        <h4>图片预览</h4>
        <input value={previewFile} onChange={e => setPreviewFile(e.target.value)} placeholder="输入图片文件名（如 xxx.png）" style={{ width: 300, marginRight: 8 }} />
        <button onClick={handlePreview} disabled={!taskId || !previewFile}>预览</button>
        {previewUrl && (
          <div style={{ marginTop: 16 }}>
            <img src={previewUrl} alt="预览" style={{ maxWidth: 400, maxHeight: 300, border: '1px solid #ccc', borderRadius: 4 }} />
          </div>
        )}
      </div>
    </div>
  );
} 