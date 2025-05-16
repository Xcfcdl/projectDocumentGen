import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Image, 
  Layout, 
  HardDrive, 
  Database, 
  Download, 
  RefreshCw,
  Edit,
  Check,
  AlertTriangle,
  X,
  ChevronRight,
  ChevronDown,
  Settings,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const EngineeringDocumentAI = () => {
  const [activeTab, setActiveTab] = useState('extraction');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [showBIMPreview, setShowBIMPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    technologies: true,
    functions: true,
    autoFill: true,
    missingData: true,
    export: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 模拟处理进度
  useEffect(() => {
    if (isProcessing) {
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            setIsProcessing(false);
            return 100;
          }
          return prev + 10;
        });
      }, 500);
      return () => clearInterval(timer);
    }
  }, [isProcessing]);

  const handleFileUpload = () => {
    setFileUploaded(true);
    setIsProcessing(true);
    setProgress(0);
  };

  // 示例数据
  const chartData = [
    { name: '识别', time: 8.2, accuracy: 92 },
    { name: '清洗', time: 3.5, accuracy: 85 },
    { name: '建模', time: 12.4, accuracy: 88 }
  ];

  const tableData = [
    { id: 'B-012', type: '承重梁', material: 'C40', size: '300x600mm', status: '已自动填充' },
    { id: 'C-205', type: '剪力墙', material: '未知', size: '200mm', status: '需人工确认' }
  ];

  const missingData = {
    missing_materials: ["C-205:混凝土标号"],
    conflict_dimensions: ["B-012与D-308衔接处"],
    auto_fixed: 82
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Header */}
      <header className="bg-blue-600 text-white h-16 flex items-center px-6 shadow-md">
        <div className="flex items-center">
          <Layout className="h-9 w-9 mr-3" />
          <h1 className="text-xl font-bold">多模态AI工程资料处理系统</h1>
        </div>
        <nav className="ml-10 flex space-x-6">
          <button className="px-3 py-1 rounded hover:bg-blue-500 transition">首页</button>
          <button className="px-3 py-1 rounded hover:bg-blue-500 transition">文档</button>
          <button className="px-3 py-1 rounded hover:bg-blue-500 transition">仪表盘</button>
        </nav>
        <div className="ml-auto bg-blue-500 px-3 py-1 rounded-full text-sm flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
          {isProcessing ? 'AI处理中' : '已完成'}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 左侧主内容区 */}
          <div className="lg:w-2/3">
            {/* 文件上传区域 */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <FileText className="mr-2" /> 工程图纸上传与处理
              </h2>
              
              {!fileUploaded ? (
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gradient-to-br from-blue-50 to-blue-100 cursor-pointer"
                  onClick={handleFileUpload}
                >
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Image className="text-blue-600" size={24} />
                  </div>
                  <p className="text-gray-600 mb-2">点击或拖拽上传工程图纸</p>
                  <p className="text-xs text-gray-500">支持格式: PDF, OFD, DWG, PNG</p>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>处理进度</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-1.5 rounded-full" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-sm mb-2 flex items-center">
                        <HardDrive className="mr-2" size={16} /> 原始文件
                      </h3>
                      <p className="text-sm text-gray-600">工程图纸.pdf</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-sm mb-2 flex items-center">
                        <Database className="mr-2" size={16} /> 处理结果
                      </h3>
                      <p className="text-sm text-gray-600">结构化数据.json</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 多模态AI技术部分 */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <Settings className="mr-2" /> 多模态AI技术与工具
                </h2>
                <button 
                  onClick={() => toggleSection('technologies')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {expandedSections.technologies ? <ChevronDown /> : <ChevronRight />}
                </button>
              </div>
              
              <AnimatePresence>
                {expandedSections.technologies && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h3 className="font-medium mb-2 flex items-center">
                          <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                            <Eye size={14} className="text-blue-600" />
                          </span>
                          计算机视觉与深度学习
                        </h3>
                        <p className="text-sm text-gray-600">
                          利用高分辨率扫描仪和OCR技术将图纸转换为数字格式，再用算法对数字图像进行处理和分析。自动识别和提取图纸中的元素、标注和注释，以及元素之间的关系和连接方式。
                        </p>
                      </div>
                      
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h3 className="font-medium mb-2 flex items-center">
                          <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-2">
                            <FileText size={14} className="text-green-600" />
                          </span>
                          OCR技术
                        </h3>
                        <p className="text-sm text-gray-600">
                          将图片、扫描件或PDF、OFD文档中的文字识别成可编辑的文本。如华为云OCR，支持通用类识别、证件类识别、票据类识别、行业类识别和智能文档解析。
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-2">相关软件和平台</h3>
                        <ul className="space-y-3">
                          <li className="flex items-start">
                            <span className="bg-purple-100 text-purple-600 rounded-full p-1 mr-2 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                                <path d="M8.5 8.5v.01"></path>
                                <path d="M16 15.5v.01"></path>
                                <path d="M12 12v.01"></path>
                                <path d="M11 17v.01"></path>
                                <path d="M7 14v.01"></path>
                              </svg>
                            </span>
                            <span className="text-sm">百度智能云的Baidu CityFactory：基于百度自研的飞桨AI框架和三维地理信息系统（3D GIS）</span>
                          </li>
                          <li className="flex items-start">
                            <span className="bg-purple-100 text-purple-600 rounded-full p-1 mr-2 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                                <path d="M8.5 8.5v.01"></path>
                                <path d="M16 15.5v.01"></path>
                                <path d="M12 12v.01"></path>
                                <path d="M11 17v.01"></path>
                                <path d="M7 14v.01"></path>
                              </svg>
                            </span>
                            <span className="text-sm">凡拓的FunAI：用户上传CAD图纸、点云扫描文件或手绘草图后，内置的多模态AI算法可自动解析结构特征</span>
                          </li>
                          <li className="flex items-start">
                            <span className="bg-purple-100 text-purple-600 rounded-full p-1 mr-2 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                                <path d="M8.5 8.5v.01"></path>
                                <path d="M16 15.5v.01"></path>
                                <path d="M12 12v.01"></path>
                                <path d="M11 17v.01"></path>
                                <path d="M7 14v.01"></path>
                              </svg>
                            </span>
                            <span className="text-sm">广联达的BIM施工图审查系统：基于广联达自主知识产权的图形平台，利用BIM技术、AI技术</span>
                          </li>
                          <li className="flex items-start">
                            <span className="bg-purple-100 text-purple-600 rounded-full p-1 mr-2 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                                <path d="M8.5 8.5v.01"></path>
                                <path d="M16 15.5v.01"></path>
                                <path d="M12 12v.01"></path>
                                <path d="M11 17v.01"></path>
                                <path d="M7 14v.01"></path>
                              </svg>
                            </span>
                            <span className="text-sm">"图智"-PDF工程图AI识别与审查重建系统：基于深度学习技术和工程领域业务知识应用的有效融合</span>
                          </li>
                          <li className="flex items-start">
                            <span className="bg-purple-100 text-purple-600 rounded-full p-1 mr-2 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                                <path d="M8.5 8.5v.01"></path>
                                <path d="M16 15.5v.01"></path>
                                <path d="M12 12v.01"></path>
                                <path d="M11 17v.01"></path>
                                <path d="M7 14v.01"></path>
                              </svg>
                            </span>
                            <span className="text-sm">CAD快速看图软件：具有开图迅速、显示准确，可批量导出、PDF轻松转换CAD</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Agent功能与实现逻辑 */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <HardDrive className="mr-2" /> Agent功能与实现逻辑
                </h2>
                <button 
                  onClick={() => toggleSection('functions')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {expandedSections.functions ? <ChevronDown /> : <ChevronRight />}
                </button>
              </div>
              
              <AnimatePresence>
                {expandedSections.functions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-2">功能</h3>
                        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                          <li>工程图纸信息提取：自动识别和提取工程图纸中的各种元素、标注和注释，以及元素之间的关系和连接方式</li>
                          <li>归纳整理：对提取的信息进行归纳整理，形成结构化的数据</li>
                          <li>资料制作：根据整理后的数据制作工程资料，如报告、图表等</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-2">实现逻辑</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <h4 className="font-medium text-sm mb-1 flex items-center">
                              <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                                <Eye size={14} className="text-blue-600" />
                              </span>
                              感知
                            </h4>
                            <p className="text-xs text-gray-600">通过计算机视觉、OCR等技术获取工程图纸中的信息，并将其转化为可处理的数据</p>
                          </div>
                          <div className="p-3 bg-purple-50 rounded-lg">
                            <h4 className="font-medium text-sm mb-1 flex items-center">
                              <span className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center mr-2">
                                <Database size={14} className="text-purple-600" />
                              </span>
                              记忆
                            </h4>
                            <p className="text-xs text-gray-600">将感知到的信息存储在知识库中，以便后续使用</p>
                          </div>
                          <div className="p-3 bg-green-50 rounded-lg">
                            <h4 className="font-medium text-sm mb-1 flex items-center">
                              <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-2">
                                <Settings size={14} className="text-green-600" />
                              </span>
                              规划与决策
                            </h4>
                            <p className="text-xs text-gray-600">根据任务需求和知识库中的信息，制定行动策略和计划</p>
                          </div>
                          <div className="p-3 bg-yellow-50 rounded-lg">
                            <h4 className="font-medium text-sm mb-1 flex items-center">
                              <span className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center mr-2">
                                <RefreshCw size={14} className="text-yellow-600" />
                              </span>
                              工具使用与行动
                            </h4>
                            <p className="text-xs text-gray-600">根据规划和决策的结果，调用相应的工具和资源，执行具体的任务</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 自动填入已有信息 */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <Check className="mr-2" /> 自动填入已有信息
                </h2>
                <button 
                  onClick={() => toggleSection('autoFill')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {expandedSections.autoFill ? <ChevronDown /> : <ChevronRight />}
                </button>
              </div>
              
              <AnimatePresence>
                {expandedSections.autoFill && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        通过RAG技术自动抓取企业内部文档、数据库、API接口等多源数据，结合实体识别与关系抽取技术，将非结构化信息转化为可计算的知识单元。然后根据工程资料的模板和规则，自动填入相应的信息。
                      </p>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">示例:</span> BetterYeah AI Agent通过自带的多模态知识库，助力电商客户实现每周处理10万+文档，分类准确率达92%。
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 处理缺失资料 */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <AlertTriangle className="mr-2" /> 处理缺失资料
                </h2>
                <button 
                  onClick={() => toggleSection('missingData')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {expandedSections.missingData ? <ChevronDown /> : <ChevronRight />}
                </button>
              </div>
              
              <AnimatePresence>
                {expandedSections.missingData && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-2">处理不确定性</h3>
                        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                          <li>数据清洗：处理缺失值、数据类型和数据格式的转换，以及数据过滤等</li>
                          <li>改进模型：选择合适的算法、调整模型参数，以及进行特征选择等，减少模型预测的不确定性</li>
                          <li>优化算法：改进算法的逻辑、优化计算过程，以及增强算法的鲁棒性等，提高算法的稳定性</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-2">处理模糊性</h3>
                        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                          <li>模糊数学理论：如模糊集、模糊逻辑等，有助于Agent在模糊环境下进行推理和决策</li>
                          <li>协商模型：使Agent能够在信息隐藏、出价、让步等方面采取策略来处理模糊的不确切需求</li>
                          <li>动态模糊测度：采用动态模糊测度的知识度量方法，有助于Agent在处理模糊信息时做出更准确的决策</li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 右侧信息预览区 */}
          <div className="lg:w-1/3">
            {/* 数据展示面板 */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">结构化数据</h2>
                <div className="flex">
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mr-2">提取信息</span>
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">缺失处理</span>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="font-medium text-sm mb-2">处理阶段统计</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                      <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="time" name="耗时(分钟)" fill="#3b82f6" />
                      <Bar yAxisId="right" dataKey="accuracy" name="准确率(%)" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-sm mb-2">图纸信息表格</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">构件ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tableData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{row.id}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row.type}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            {row.status === '已自动填充' ? (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {row.status}
                              </span>
                            ) : (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                {row.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 缺失处理清单 */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">缺失处理清单</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm mb-1 flex items-center">
                    <X className="text-red-500 mr-2" size={16} /> 缺失材料
                  </h3>
                  <ul className="pl-5 space-y-1 text-sm text-gray-600">
                    {missingData.missing_materials.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-500 mr-1">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium text-sm mb-1 flex items-center">
                    <AlertTriangle className="text-yellow-500 mr-2" size={16} /> 尺寸冲突
                  </h3>
                  <ul className="pl-5 space-y-1 text-sm text-gray-600">
                    {missingData.conflict_dimensions.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-yellow-500 mr-1">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="pt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">自动修复率</span>
                    <span>{missingData.auto_fixed}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full" 
                      style={{ width: `${missingData.auto_fixed}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* BIM模型预览 */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">BIM模型预览</h2>
                <button 
                  onClick={() => setShowBIMPreview(!showBIMPreview)}
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                >
                  {showBIMPreview ? '隐藏' : '显示'}预览
                  {showBIMPreview ? <ChevronDown className="ml-1" size={16} /> : <ChevronRight className="ml-1" size={16} />}
                </button>
              </div>
              
              <AnimatePresence>
                {showBIMPreview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
                      <div className="text-center">
                        <Layout className="mx-auto text-gray-400 mb-2" size={32} />
                        <p className="text-sm text-gray-500">BIM模型预览</p>
                      </div>
                    </div>
                    <div className="flex justify-center mt-3 space-x-2">
                      <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                        <ZoomIn size={16} />
                      </button>
                      <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                        <ZoomOut size={16} />
                      </button>
                      <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 导出功能 */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <Download className="mr-2" /> 导出功能
                </h2>
                <button 
                  onClick={() => toggleSection('export')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {expandedSections.export ? <ChevronDown /> : <ChevronRight />}
                </button>
              </div>
              
              <AnimatePresence>
                {expandedSections.export && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        使用Python的pandas库来处理xlsx表格。将制作好的图表数据存储为xlsx格式，并提供下载链接。
                      </p>
                      <div className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
                        <pre className="text-xs text-gray-700">
                          {`import pandas as pd

# 示例数据
data = {
    '列1': [1, 2, 3],
    '列2': ['a', 'b', 'c']
}

# 创建DataFrame对象
df = pd.DataFrame(data)

# 保存为xlsx文件
df.to_excel('图表.xlsx', index=False)`}
                        </pre>
                      </div>
                      <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center">
                        <Download className="mr-2" size={16} />
                        导出为XLSX
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* 底部工具栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="container mx-auto px-4 py-3 flex justify-between">
          <div className="flex space-x-3">
            <button className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center">
              <Download className="mr-2" size={16} />
              导出XLSX
            </button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center">
              <RefreshCw className="mr-2" size={16} />
              重新识别
            </button>
          </div>
          <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg flex items-center">
            <Edit className="mr-2" size={16} />
            人工修正
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-100 border-t border-gray-200 py-6 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600">
          <p>created by <a href="https://space.coze.cn" className="text-blue-600 hover:underline">coze space</a></p>
          <p className="mt-1">页面内容均由 AI 生成，仅供参考</p>
        </div>
      </footer>
    </div>
  );
};

export default EngineeringDocumentAI;