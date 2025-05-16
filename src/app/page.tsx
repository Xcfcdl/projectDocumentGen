"use client";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { Layout, FileText, Settings, Download, BarChart3, ChevronRight } from "lucide-react";

// 新增全局居中弹窗动效组件
function GlobalLoadingModal({ text, progress }: { text: string, progress?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 全局蒙版：半透明蓝色 */}
      <div className="absolute inset-0 bg-blue-200/60"></div>
      {/* 居中弹窗 */}
      <div className="relative z-10 bg-white rounded-xl shadow-lg px-8 py-8 flex flex-col items-center min-w-[320px]">
        <div className="w-14 h-14 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <div className="text-blue-700 font-bold text-lg mb-1">{text}</div>
        {progress && <div className="text-sm text-blue-500">{progress}</div>}
      </div>
    </div>
  );
}

// 类型声明
type BudgetItem = {
  name?: string;
  quantity?: string | number | null;
  unit?: string;
  unit_price?: string | number | null;
  total_price?: string | number | null;
  labor_ratio?: string | number | null;
  material_ratio?: string | number | null;
};
type BudgetSubProject = {
  major?: string;
  items?: BudgetItem[];
};

// 通用递归渲染函数：将任意对象/数组渲染为嵌套表格
function renderTable(data: any, parentKey = ''): React.ReactNode {
  if (Array.isArray(data)) {
    if (data.length === 0) return <div>无数据</div>;
    // 如果是对象数组，取所有key为表头
    const allKeys = Array.from(new Set(data.flatMap(item => typeof item === 'object' && item !== null ? Object.keys(item) : [])));
    return (
      <table className="min-w-full text-xs border border-gray-200 mb-4">
        <thead className="bg-gray-100">
          <tr>
            {allKeys.map(key => <th key={key} className="px-2 py-1 border">{key}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => {
            if (item === null || item === undefined) {
              return <tr key={idx}><td colSpan={allKeys.length}>无</td></tr>;
            }
            if (typeof item === 'object' && Object.keys(item).length === 0) {
              return <tr key={idx}><td colSpan={allKeys.length}>无</td></tr>;
            }
            if (typeof item === 'object') {
              return (
                <tr key={idx}>
                  {allKeys.map(key =>
                    <td key={key} className="px-2 py-1 border">
                      {typeof item?.[key] === 'object' && item[key] !== null
                        ? renderTable(item[key], key)
                        : item?.[key] ?? ''}
                    </td>
                  )}
                </tr>
              );
            }
            // 其他类型直接渲染
            return <tr key={idx}><td colSpan={allKeys.length}>{String(item)}</td></tr>;
          })}
        </tbody>
      </table>
    );
  } else if (typeof data === 'object' && data !== null) {
    // 空对象特殊处理
    if (Object.keys(data).length === 0) return <span>无</span>;
    return (
      <table className="min-w-full text-xs border border-gray-200 mb-4">
        <tbody>
          {Object.entries(data).map(([key, value]) => (
            <tr key={key}>
              <td className="px-2 py-1 border bg-gray-50 font-semibold w-32">{key}</td>
              <td className="px-2 py-1 border">
                {typeof value === 'object' && value !== null
                  ? renderTable(value, key)
                  : value ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else {
    // null/undefined/基本类型
    if (data === null || data === undefined) return '';
    return <span>{data}</span>;
  }
}

export default function Home() {
  // AI智能提取相关状态
  const [files, setFiles] = useState<FileList | null>(null);
  const [taskId, setTaskId] = useState("");
  const [allImages, setAllImages] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false); // 新增归纳动效状态
  const [extractResults, setExtractResults] = useState<Record<string, string | object>>({});
  const [summary, setSummary] = useState<string | object | null>(null);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"init"|"uploaded"|"extracted"|"summarized">("init");
  const [genType, setGenType] = useState("");
  const [budgetData, setBudgetData] = useState<any>(null);
  const [extractTokens, setExtractTokens] = useState(0); // 逐张提取token总和
  const [summaryTokens, setSummaryTokens] = useState(0); // 归纳总结token总和
  const [isGenBudget, setIsGenBudget] = useState(false); // 新增生成概算表动效状态
  const [showUploadConfirm, setShowUploadConfirm] = useState(false); // 上传合规弹窗

  // 上传文件
  const handleUpload = async () => {
    if (!files || files.length === 0) {
      setMessage("请先选择文件");
      return;
    }
    setShowUploadConfirm(false); // 关闭弹窗
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
    setMessage("");
    const results: Record<string, string | object> = {};
    let totalExtractTokens = 0;
    for (let i = 0; i < selected.length; i++) {
      const img = selected[i];
      // 动态进度提示
      setMessage(`AI提取中: ${img} (${i + 1}/${selected.length})`);
      const res = await fetch("/api/extract/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, filename: img }),
      });
      const data = await res.json();
      // 立即累加token
      if (data.usage && typeof data.usage.total_tokens === 'number') {
        totalExtractTokens += data.usage.total_tokens;
      }
      results[img] = data.result || data.error;
      setExtractResults({ ...results });
    }
    setExtractTokens(totalExtractTokens);
    setExtracting(false);
    setMessage("全部提取完成，自动归纳整理中...");
    setStep("extracted");
    // 自动归纳
    await handleSummary(totalExtractTokens);
  };

  // 归纳整理
  const handleSummary = async (extractTokensFromPrev?: number) => {
    setIsSummarizing(true);
    setMessage("");
    setStep("extracted");
    const res = await fetch("/api/extract/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, files: selected }),
    });
    const data = await res.json();
    if (data.usage && typeof data.usage.total_tokens === 'number') {
      setSummaryTokens(data.usage.total_tokens);
    } else {
      setSummaryTokens(0);
    }
    setSummary(data.summary || data.error);
    setMessage(data.summary ? "归纳整理完成" : data.error || "归纳失败");
    setStep("summarized");
    setIsSummarizing(false);
  };

  const handleGenBudget = async () => {
    setIsGenBudget(true);
    setMessage("生成概算表中...");
    const res = await fetch("/api/extract/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, summary }),
    });
    const data = await res.json();
    setBudgetData(data.summary || data.error);
    setMessage(data.summary ? "生成概算表完成" : data.error || "生成失败");
    setIsGenBudget(false);
  };

  const handleDownloadBudget = async () => {
    if (!budgetData) {
      setMessage("请先生成概算表");
      return;
    }
    setMessage("正在导出JSON...");
    try {
      const blob = new Blob([JSON.stringify(budgetData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `概算表.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      setMessage("导出成功");
    } catch (e) {
      setMessage("导出失败，浏览器不支持或数据异常");
    }
  };

  // 概算表导出为CSV
  const handleDownloadBudgetCSV = () => {
    if (!budgetData || !Array.isArray(budgetData.subprojects)) {
      setMessage("请先生成概算表");
      return;
    }
    let csv = '专业,名称,数量,单位,单价,合价,人工占比,材料占比\n';
    for (const sp of budgetData.subprojects) {
      if (Array.isArray(sp.items)) {
        for (const item of sp.items) {
          csv += [
            sp.major ?? '',
            item.name ?? '',
            item.quantity ?? '',
            item.unit ?? '',
            item.unit_price ?? '',
            item.total_price ?? '',
            item.labor_ratio ?? '',
            item.material_ratio ?? ''
          ].join(',') + '\n';
        }
      }
    }
    // 加BOM防止Excel乱码
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv; charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '概算表.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage("CSV导出成功");
  };

  useEffect(() => {
    const notifyCleanup = () => {
      if (taskId) {
        fetch('/api/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: taskId }),
          keepalive: true
        });
      }
    };
    window.addEventListener('beforeunload', notifyCleanup);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') notifyCleanup();
    });
    return () => {
      window.removeEventListener('beforeunload', notifyCleanup);
      document.removeEventListener('visibilitychange', notifyCleanup);
    };
  }, [taskId]);

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
          
          <a href="/docs" className="px-3 py-1 rounded hover:bg-blue-500 transition">使用文档</a>
        </nav>
        <div className="ml-auto bg-blue-500 px-3 py-1 rounded-full text-sm flex items-center">
          <div className="w-2 h-2 rounded-full mr-2 bg-green-400"></div>
          系统开发测试中
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
            {/* 动效：AI提取/归纳/生成概算表中 */}
            {(extracting || isSummarizing || isGenBudget) && (
              <GlobalLoadingModal
                text={extracting
                  ? "AI提取中..."
                  : isSummarizing
                    ? "AI归纳整理中..."
                    : "生成概算表中..."}
                progress={extracting ? `已完成${Object.keys(extractResults).length}/${selected.length}页` : undefined}
              />
            )}
            <div className="mb-2 flex items-center gap-3">
              <label className="cursor-pointer bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold px-4 py-2 rounded shadow border border-blue-300 transition-all duration-150 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v12" /></svg>
                {files && files.length > 0
                  ? files.length === 1
                    ? files[0].name
                    : `${files[0].name} 等${files.length}个文件`
                  : '选择文件'}
                <input type="file" multiple accept="application/pdf,image/*" 
                  onChange={e => {
                    const files = e.target.files;
                    if (!files || files.length === 0) {
                      setFiles(null);
                      return;
                    }
                    let pdfCount = 0, imgCount = 0;
                    for (let i = 0; i < files.length; i++) {
                      const ext = files[i].name.split('.').pop()?.toLowerCase();
                      if (ext === 'pdf') pdfCount++;
                      else if (["jpg","jpeg","png","bmp","gif","webp"].includes(ext || '')) imgCount++;
                    }
                    if ((pdfCount === 1 && imgCount === 0 && files.length === 1) ||
                        (pdfCount === 0 && imgCount > 0)) {
                      setFiles(files);
                    } else {
                      setFiles(null);
                      setMessage('只允许上传单个PDF，或多张图片，不能混选或多个PDF');
                      e.target.value = '';
                    }
                  }}
                  className="hidden" />
              </label>
              <button
                onClick={() => setShowUploadConfirm(true)}
                disabled={!files || files.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded shadow transition-all duration-150 disabled:opacity-60"
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
                  {typeof summary === 'string'
                    ? summary
                    : summary && typeof summary === 'object'
                      ? JSON.stringify(summary, null, 2)
                      : ''}
                </pre>
                {/* Token统计展示 */}
                <div className="mt-2 text-sm text-gray-700">
                  <div>逐张提取Token总和：<b>{extractTokens}</b></div>
                  <div>归纳总结Token总和：<b>{summaryTokens}</b></div>
                  <div>Token总计：<b>{extractTokens + summaryTokens}</b></div>
                </div>
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
                    <h5 className="font-semibold mb-2">概算表全部数据</h5>
                    <div className="overflow-x-auto">
                      {renderTable(budgetData)}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={handleDownloadBudget}
                        disabled={!budgetData}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded disabled:opacity-60"
                      >
                        下载为JSON
                      </button>
                      <button
                        onClick={handleDownloadBudgetCSV}
                        disabled={!budgetData}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded disabled:opacity-60"
                      >
                        下载为CSV
                      </button>
                    </div>
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
          {/* 合规说明与隐私保护卡片 */}
          <div className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-4">
            <h2 className="text-lg font-semibold flex items-center mb-2">
              <BarChart3 className="mr-2" /> 合规说明与隐私保护
            </h2>
            <div className="text-sm text-gray-600 mb-2">请务必遵守以下合规与隐私保护要求：</div>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>本系统仅用于工程文档AI处理的技术演示与数据结构化研究。</li>
              <li>请勿上传任何涉密、敏感、国家/企业/个人隐私类图纸或资料。</li>
              <li>所有上传文件和数据将在用户会话断开1分钟后自动彻底删除，不做长期存储。</li>
              <li>我们承诺不用于任何与用户无关的用途，不做数据分析、归档或外泄。</li>
              <li>如需处理涉密或敏感数据，请联系专属定制服务，确保合规与安全。</li>
              <li>上传即视为同意本隐私保护与合规声明。</li>
            </ul>
          </div>

          {/* 联系与说明卡片 */}
          <div className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-2 text-xs text-gray-500">
            <div>如需定制或技术支持，请联系 <a href="mailto:ai-support@example.com" className="text-blue-600 hover:underline">ai-support@example.com</a></div>
            <div>© 2024 工程文档 AI 处理系统</div>
          </div>
        </div>
      </main>

      {/* 上传合规弹窗 */}
      {showUploadConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-200/60"></div>
          <div className="relative z-10 bg-white rounded-xl shadow-lg px-8 py-8 flex flex-col items-center min-w-[340px] max-w-[90vw]">
            <div className="text-lg font-bold text-blue-700 mb-2">合规与隐私提醒</div>
            <div className="text-gray-700 text-sm mb-4 text-left">
              <ul className="list-disc pl-5 space-y-1">
                <li>请勿上传任何涉密、敏感、国家/企业/个人隐私类图纸或资料。</li>
                <li>所有文件将上传至服务器并传输到AI大模型进行处理。</li>
                <li>点击"确认上传"即视为同意本合规与隐私声明。</li>
                <li>如误操作请立刻联系管理员删除，否则文件也会在刷新或者关闭窗口5分钟后自动彻底删除。<strong>但是如果文件被AI提取过，由于公用 ai 模型不归我们所有，我们不保证文件的安全性。</strong></li>
                <li>本系统仅用于工程文档AI处理的技术演示与数据结构化研究。</li>
                <li>本系统不提供任何涉密或敏感数据处理服务，如需处理涉密或敏感数据，请联系专属定制服务，确保合规与安全。</li>
              </ul>
            </div>
            <div className="flex gap-4 mt-2">
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded shadow"
                onClick={handleUpload}
              >确认上传</button>
              <button
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded shadow"
                onClick={() => setShowUploadConfirm(false)}
              >取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
