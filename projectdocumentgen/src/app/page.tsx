"use client";
import Link from "next/link";
import React, { useState } from "react";
import { Layout, FileText, Settings, Download, BarChart3, ChevronRight } from "lucide-react";

export default function Home() {
  // AI智能提取相关状态
  const [files, setFiles] = useState<FileList | null>(null);
  const [taskId, setTaskId] = useState("");
  const [allImages, setAllImages] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractResults, setExtractResults] = useState<Record<string, string | object>>({});
  const [summary, setSummary] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"init"|"uploaded"|"extracted"|"summarized">("init");
  const [genType, setGenType] = useState("");
  const [budgetData, setBudgetData] = useState<any>(null);

  // 上传文件
  const handleUpload = async () => {
    if (!files || files.length === 0) {
      setMessage("请先选择文件");
      return;
    }
    setMessage("上传中...");
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.task_id) {
        setTaskId(data.task_id);
        setAllImages(data.images);
        setSelected(data.images);
        setMessage("上传成功，已自动选中全部图片，可手动调整");
        setStep("uploaded");
        setExtractResults({});
        setSummary(null);
      } else {
        setMessage(data.error || "上传失败");
      }
    } catch (e) {
      setMessage("上传失败，服务器错误或返回内容异常");
    }
  };

  // 选择图片
  const toggleSelect = (img: string) => {
    setSelected((prev) => prev.includes(img) ? prev.filter(i => i !== img) : [...prev, img]);
  };

  // 批量AI提取
  const handleExtract = async () => {
    if (!taskId || selected.length === 0) {
      setMessage("请先上传并选择图片");
      return;
    }
    setExtracting(true);
    setMessage("AI提取中...");
    const results: Record<string, string | object> = {};
    for (const img of selected) {
      setMessage(`AI提取中: ${img}`);
      const res = await fetch("/api/extract/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, filename: img }),
      });
      const data = await res.json();
      results[img] = data.result || data.error;
      setExtractResults({ ...results });
    }
    setExtracting(false);
    setMessage("全部提取完成，可归纳整理");
    setStep("extracted");
  };

  // 归纳整理
  const handleSummary = async () => {
    setMessage("AI归纳整理中...");
    const res = await fetch("/api/extract/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, files: selected }),
    });
    const data = await res.json();
    setSummary(data.summary || data.error);
    setMessage(data.summary ? "归纳整理完成" : data.error || "归纳失败");
    setStep("summarized");
  };

  const handleGenBudget = async () => {
    setMessage("生成概算表中...");
    const res = await fetch("/api/extract/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, summary }),
    });
    const data = await res.json();
    setBudgetData(data.summary || data.error);
    setMessage(data.summary ? "生成概算表完成" : data.error || "生成失败");
  };

  const handleDownloadBudget = async () => {
    const res = await fetch("/api/download/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: budgetData }),
    });
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `概算表.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Header */}
      <header className="bg-blue-600 text-white h-16 flex items-center px-6 shadow-md">
        <div className="flex items-center">
          <Layout className="h-9 w-9 mr-3" />
          <h1 className="text-xl font-bold">工程文档 AI 处理系统</h1>
        </div>
        <nav className="ml-10 flex space-x-6">
          <Link href="/" className="px-3 py-1 rounded hover:bg-blue-500 transition">首页</Link>
          
          <a href="/api-docs" className="px-3 py-1 rounded hover:bg-blue-500 transition">API 文档</a>
        </nav>
        <div className="ml-auto bg-blue-500 px-3 py-1 rounded-full text-sm flex items-center">
          <div className="w-2 h-2 rounded-full mr-2 bg-green-400"></div>
          系统就绪
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 flex flex-col lg:flex-row gap-8">
        {/* 左侧主内容区 */}
        <div className="lg:w-2/3 flex flex-col gap-6">
          {/* 系统简介卡片 */}
          <div className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-4">
            <h2 className="text-xl font-semibold flex items-center mb-2">
              <FileText className="mr-2" /> 工程文档 AI 处理系统
            </h2>
            <p className="text-gray-700">
              支持 PDF/图片上传、AI 智能表格生成、任务进度追踪、结果下载与图片预览。<br />
              体验多模态工程文档的自动化处理与数据整理。
            </p>
          </div>

          {/* AI智能提取卡片 */}
          <div className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-4">
            <h2 className="text-lg font-semibold flex items-center mb-2">
              <ChevronRight className="mr-2" /> AI 智能提取（全流程）
            </h2>
            <div className="mb-2 flex items-center gap-3">
              <label className="cursor-pointer bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold px-4 py-2 rounded shadow border border-blue-300 transition-all duration-150 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v12" /></svg>
                {files && files.length > 0
                  ? files.length === 1
                    ? files[0].name
                    : `${files[0].name} 等${files.length}个文件`
                  : '选择文件'}
                <input type="file" multiple accept="application/pdf,image/*" onChange={e => setFiles(e.target.files)} className="hidden" />
              </label>
              <button
                onClick={handleUpload}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded shadow transition-all duration-150"
              >
                上传
              </button>
            </div>
            {allImages.length > 0 && (
              <div>
                <div className="mb-2 text-sm text-gray-600">图片预览（点击选择/取消，默认全选）</div>
                <div className="flex flex-wrap gap-2">
                  {allImages.map(img => (
                    <div key={img} className={`border rounded p-1 cursor-pointer ${selected.includes(img) ? 'border-blue-500' : 'border-gray-200'}`} onClick={() => toggleSelect(img)}>
                      <img src={`/uploads/${taskId}/${img}`} alt={img} style={{ width: 80, height: 100, objectFit: 'cover', opacity: selected.includes(img) ? 1 : 0.4 }} />
                      <div className="text-xs text-center mt-1" style={{ maxWidth: 80 }}>{img}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {allImages.length > 0 && (
              <div className="mt-4 flex gap-2">
                <button onClick={handleExtract} disabled={extracting || selected.length === 0} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded">开始提取</button>
                <button
                  onClick={handleSummary}
                  disabled={
                    extracting ||
                    selected.length === 0 ||
                    !selected.every(img => extractResults[img] !== undefined)
                  }
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded"
                >
                  归纳整理
                </button>
              </div>
            )}
            <div className="mt-2 text-blue-600 text-sm min-h-[24px]">{message}</div>
            {/* 提取结果展示 */}
            {Object.keys(extractResults).length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">单页提取结果</h4>
                <div className="flex flex-wrap gap-4">
                  {selected.map(img => (
                    <div key={img} className="w-[220px] border rounded p-2 bg-gray-50">
                      <div className="text-xs mb-1 font-bold">{img}</div>
                      <pre className="text-xs bg-white p-2 rounded max-h-40 overflow-auto">
                        {extractResults[img] !== undefined && extractResults[img] !== null
                          ? typeof extractResults[img] === "string"
                            ? extractResults[img]
                            : JSON.stringify(extractResults[img], null, 2)
                          : ''}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 归纳整理结果展示 */}
            {summary && (
              <div className="mt-6">
                <h4 className="font-semibold mb-2">归纳整理结果</h4>
                <pre className="text-xs bg-gray-50 p-3 rounded max-h-80 overflow-auto">
                  {typeof summary === 'string' ? String(summary) : JSON.stringify(summary, null, 2)}
                </pre>
                {/* 新增：下拉菜单和生成概算表功能 */}
                <div className="mt-4 flex items-center gap-2">
                  <select
                    value={genType}
                    onChange={e => setGenType(e.target.value)}
                    className="border rounded px-2 py-1"
                  >
                    <option value="">请选择操作</option>
                    <option value="budget">生成概算表</option>
                  </select>
                  {genType === 'budget' && (
                    <button
                      onClick={handleGenBudget}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded"
                    >
                      生成概算表
                    </button>
                  )}
                </div>
                {/* 概算表展示与下载 */}
                {budgetData && (
                  <div className="mt-4">
                    <h5 className="font-semibold mb-2">概算表结果</h5>
                    <pre className="text-xs bg-white p-2 rounded max-h-80 overflow-auto">{JSON.stringify(budgetData, null, 2)}</pre>
                    <button
                      onClick={handleDownloadBudget}
                      className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded"
                    >
                      下载为概算表
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 系统亮点卡片 */}
          <div className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-4">
            <h2 className="text-lg font-semibold flex items-center mb-2">
              <Settings className="mr-2" /> 系统亮点
            </h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>多模态文件支持：PDF、图片、工程图纸等</li>
              <li>AI 智能表格与数据提取</li>
              <li>任务进度实时追踪与结果下载</li>
              <li>图片预览与表格导出（Excel/JSON）</li>
              <li>前后端一体化，支持 API 扩展</li>
            </ul>
          </div>
        </div>

        {/* 右侧信息区 */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          {/* 数据统计/示例卡片 */}
          <div className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-4">
            <h2 className="text-lg font-semibold flex items-center mb-2">
              <BarChart3 className="mr-2" /> 示例数据
            </h2>
            <div className="text-sm text-gray-600 mb-2">（此处可接入系统统计或展示示例表格/图表）</div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Download className="text-blue-500" size={18} />
                <span>已处理文档：<b>128</b> 份</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="text-green-500" size={18} />
                <span>表格导出：<b>76</b> 次</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings className="text-purple-500" size={18} />
                <span>API 调用：<b>320</b> 次</span>
              </div>
            </div>
          </div>

          {/* 联系与说明卡片 */}
          <div className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-2 text-xs text-gray-500">
            <div>如需定制或技术支持，请联系 <a href="mailto:ai-support@example.com" className="text-blue-600 hover:underline">ai-support@example.com</a></div>
            <div>© 2024 工程文档 AI 处理系统</div>
          </div>
        </div>
      </main>
    </div>
  );
}
