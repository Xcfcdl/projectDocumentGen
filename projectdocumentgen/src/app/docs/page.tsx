import React from "react";
import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-blue-600 text-white h-16 flex items-center px-6 shadow-md">
        <div className="flex items-center">
          <span className="h-9 w-9 mr-3 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">AI</span>
          <h1 className="text-xl font-bold">工程文档AI处理系统 - 使用文档</h1>
        </div>
        <nav className="ml-10 flex space-x-6">
          <Link href="/" className="px-3 py-1 rounded hover:bg-blue-500 transition">首页</Link>
          <span className="px-3 py-1 rounded bg-blue-500">使用文档</span>
        </nav>
      </header>
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-6">
          <section>
            <h2 className="text-lg font-bold mb-2">系统简介</h2>
            <p>本系统用于工程文档（如PDF、图片等）的AI智能提取、归纳、结构化与自动化表格生成，适用于工程资料整理、数据归档、智能分析等场景。</p>
          </section>
          <section>
            <h2 className="text-lg font-bold mb-2">主要功能</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>支持PDF、图片等多种格式的工程文档上传与预览</li>
              <li>AI智能提取图纸内容，自动归纳整理为结构化数据</li>
              <li>一键生成工程概算表，支持JSON/CSV导出</li>
              <li>全流程自动化，Token消耗透明可见</li>
              <li>数据与交互全中文，符合工程行业习惯</li>
              <li>自动清理上传数据，保护用户隐私</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold mb-2">操作流程</h2>
            <ol className="list-decimal pl-6 space-y-1">
              <li>点击"选择文件"，上传单个PDF或多张图片（不可混选）</li>
              <li>点击"上传"，阅读合规与隐私提醒，确认后开始上传</li>
              <li>上传成功后，系统自动进入AI提取与归纳流程</li>
              <li>提取与归纳完成后，可在页面查看结构化结果与Token统计</li>
              <li>可选择生成概算表，并支持下载为JSON或CSV</li>
              <li>所有数据将在会话断开1分钟后自动彻底删除</li>
            </ol>
          </section>
          <section>
            <h2 className="text-lg font-bold mb-2">合规与隐私说明</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>请勿上传任何涉密、敏感、国家/企业/个人隐私类图纸或资料</li>
              <li>所有文件将上传至服务器并传输到AI大模型进行处理</li>
              <li>如误操作请立刻联系管理员删除，否则文件也会在刷新或关闭窗口1分钟后自动彻底删除</li>
              <li>如果文件被AI提取过，由于公用AI模型不归我们所有，我们不保证文件的安全性</li>
              <li>本系统仅用于工程文档AI处理的技术演示与数据结构化研究</li>
              <li>本系统不提供任何涉密或敏感数据处理服务，如需处理涉密或敏感数据，请联系专属定制服务，确保合规与安全</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold mb-2">常见问题</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Q: 为什么上传后数据会自动删除？<br/>A: 为保护隐私，所有数据会在会话断开1分钟后自动彻底删除。</li>
              <li>Q: 支持哪些文件格式？<br/>A: 支持单个PDF或多张图片（jpg/png/bmp/gif/webp等），不支持混选。</li>
              <li>Q: 下载的概算表格式有哪些？<br/>A: 支持JSON和CSV两种格式，均为本地生成，兼容Excel。</li>
              <li>Q: 上传了错误文件怎么办？<br/>A: 可联系管理员立刻删除，或等待系统自动清理。</li>
              <li>Q: AI提取的数据是否100%准确？<br/>A: AI提取结果仅供参考，建议人工复核。</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
} 