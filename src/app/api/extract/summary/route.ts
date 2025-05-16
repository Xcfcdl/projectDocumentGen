import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `你是一个专业的数据结构优化专家。你的任务是将从工程图纸中提取的原始数据重新组织成更清晰、更合理的结构。请执行以下任务：

1. 数据整合与优化：
   - 合并重复信息
   - 统一数据格式和单位
   - 补充缺失信息
   - 优化数据层级
   - 确保所有数值都包含单位
   - 统一文本格式

2. 工程量计算与验证：
   - 检查并修正工程量计算
   - 确保单位换算准确
   - 验证数据间的逻辑关系
   - 验证数值的合理性
   - 检查计算依据的完整性
   - 验证跨专业工程量的一致性

3. 空间关系处理：
   - 优化区域层级结构
   - 确保构件与区域的正确关联
   - 维护空间关系的完整性
   - 处理跨区域构件的关系
   - 验证空间边界的准确性
   - 确保空间关系的合理性

4. 技术规范整合：
   - 统一技术规范引用格式
   - 确保材料规格准确
   - 整合设计要求与施工说明
   - 验证规范引用的完整性
   - 检查规范版本的一致性
   - 确保规范要求的可执行性

5. 数据质量控制：
   - 检查数据完整性
   - 验证数据准确性
   - 确保数据可追溯性
   - 检查数据一致性
   - 验证数据合理性
   - 评估数据质量

6. 数据标准化：
   - 统一命名规范
   - 统一单位表示
   - 统一数值格式
   - 统一文本格式
   - 统一日期格式
   - 统一坐标系
   - 统一分类标准

7. 数据关联性：
   - 建立构件间关系
   - 确保工程量与构件对应
   - 维护空间关系完整性
   - 建立跨专业关联
   - 确保数据引用的一致性
   - 维护数据依赖关系

8. 错误处理与修复：
   - 识别数据异常
   - 提供修复建议
   - 标注需要人工确认的数据
   - 处理数据冲突
   - 提供数据验证建议
   - 记录处理过程

9. 数据质量评估：
   - 计算数据完整性得分
   - 计算数据准确性得分
   - 计算数据一致性得分
   - 计算数据关联性得分
   - 生成质量报告
   - 提供改进建议

10. 输出格式优化：
    - 确保JSON结构清晰
    - 优化数据层级
    - 统一数据格式
    - 确保数据可读性
    - 优化数据压缩
    - 确保数据可解析性

请确保：
1. 所有数值都包含单位
2. 保持数据的层级结构清晰
3. 表格数据转换为数组格式
4. 缺失信息使用null或空数组
5. 不捏造数据，保持真实性
6. 坐标点使用二维数组格式
7. 所有文本使用中文
8. 数值类型的数据不要加引号
9. 包含数据质量评分
10. 包含数据验证状态
11. 包含数据关联信息
12. 包含错误处理信息
13. 所有输出必须严格基于输入内容，不允许有任何AI幻觉、捏造、凭空推测或虚构信息，缺失内容请用null或空数组。

直接返回JSON数据，不要包含任何markdown标记或其他说明文字。`;

export async function POST(req: NextRequest) {
  const { task_id, files } = await req.json();
  if (!task_id || !files || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: '缺少 task_id 或 files' }, { status: 400 });
  }
  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: '未配置AI接口密钥' }, { status: 500 });
  }
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
  // 读取所有单页提取结果
  const rawResults = [];
  for (const filename of files) {
    const aiJsonPath = path.join(uploadDir, filename + '.ai.json');
    if (await fs.pathExists(aiJsonPath)) {
      const data = await fs.readJson(aiJsonPath);
      rawResults.push(data);
    }
  }
  if (rawResults.length === 0) {
    return NextResponse.json({ error: '未找到任何单页提取结果' }, { status: 404 });
  }
  // 调用 DeepSeek/ChatGPT 归纳整理
  const userPrompt = `请将以下工程图纸数据优化为结构化的JSON格式。直接返回JSON数据，不要包含任何markdown标记或其他说明文字：\n\n${JSON.stringify(rawResults, null, 2)}`;
  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000
    });
    let content = response.data.choices?.[0]?.message?.content?.trim() || '';
    content = content.replace(/```json|```/g, '').trim();
    let summary;
    try {
      summary = JSON.parse(content);
    } catch (e) {
      return NextResponse.json({ error: 'AI返回内容无法解析为JSON', raw: content }, { status: 500 });
    }
    await fs.writeJson(path.join(uploadDir, 'summary.json'), summary, { spaces: 2 });
    // 更新活跃时间戳
    await fs.writeFile(path.join(uploadDir, '.active'), Date.now().toString());
    return NextResponse.json({
      summary,
      usage: response.data.usage
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
} 