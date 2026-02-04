# 导入成员示例 (Import Members Examples)

本文档提供了3个不同的CSV导入示例，展示不同的字段组合和格式。

---

## 示例 1: 最简单的格式（仅必需字段）

这是最简单的格式，只包含必需的字段：**Name** 和 **Email**。

### CSV 格式：

```csv
Name,Email
Ahmed Khan,ahmed.khan@example.com
Fatima Ali,fatima.ali@example.com
Mohammed Rahman,mohammed.rahman@example.com
Ayesha Hussain,ayesha.hussain@example.com
```

### 说明：
- ✅ 最少字段，适合快速导入
- ✅ 所有其他字段将使用默认值：
  - Status: `Active`
  - Subscription Type: `Lifetime`
  - Start Date: 今天的日期

---

## 示例 2: 标准格式（常用字段）

这是最常用的格式，包含大部分常用字段。

### CSV 格式：

```csv
Name,Email,Phone,Native,Status,Subscription Type,Subscription Year,Start Date
Ahmed Khan,ahmed.khan@example.com,+85291234567,Hong Kong,Active,Annual Member,2024,2024-01-15
Fatima Ali,fatima.ali@example.com,+85298765432,India,Active,Lifetime Janaza Fund Member,2024,2024-02-01
Mohammed Rahman,mohammed.rahman@example.com,+85255512345,Pakistan,Active,Lifetime Membership,2024,2024-03-10
Ayesha Hussain,ayesha.hussain@example.com,+85223456789,Bangladesh,Active,Annual Member,2024,2024-01-20
```

### 说明：
- ✅ 包含最常用的字段
- ✅ 包含不同的订阅类型示例
- ✅ 电话号码格式：必须包含国家代码（如 +852）
- ✅ 日期格式：YYYY-MM-DD

---

## 示例 3: 完整格式（包含所有字段）

这是最完整的格式，包含所有支持的字段，包括 **Member ID**。

### CSV 格式：

```csv
Member ID,Name,Email,Phone,Native,Status,Subscription Type,Subscription Year,Start Date
1001,Ahmed Khan,ahmed.khan@example.com,+85291234567,Hong Kong,Active,Annual Member,2024,2024-01-15
1002,Fatima Ali,fatima.ali@example.com,+85298765432,India,Active,Lifetime Janaza Fund Member,2024,2024-02-01
1003,Mohammed Rahman,mohammed.rahman@example.com,+85255512345,Pakistan,Active,Lifetime Membership,2024,2024-03-10
1004,Ayesha Hussain,ayesha.hussain@example.com,+85223456789,Bangladesh,Active,Annual Member,2024,2024-01-20
1005,Ibrahim Hassan,ibrahim.hassan@example.com,+85287654321,Malaysia,Active,Lifetime Membership,2024,2024-04-05
```

### 说明：
- ✅ 包含所有字段，包括 Member ID
- ✅ Member ID 是可选字段，如果不提供，系统会自动生成
- ✅ 包含多种订阅类型的示例
- ✅ 适用于需要完整数据记录的导入

---

## 字段说明

### 必需字段（Required）
- **Name**: 成员姓名（至少2个字符）
- **Email**: 电子邮件地址（有效格式）

### 可选字段（Optional）
- **Member ID**: 成员ID（如果不提供，系统会自动生成）
- **Phone / WhatsApp / Mobile**: 电话号码（必须包含国家代码，如 +852）
- **Native / Native Place**: 原籍/出生地
- **Status**: 成员状态（`Active` 或 `Inactive`，默认为 `Active`）
- **Subscription Type**: 订阅类型（见下面的有效值）
- **Subscription Year**: 订阅年份（1900-2100）
- **Start Date / Date**: 开始日期（YYYY-MM-DD 格式或 Excel 日期格式）

### 有效的订阅类型（Subscription Type）

必须**完全匹配**以下值（区分大小写）：

1. `Annual Member` - 年度会员
2. `Lifetime Janaza Fund Member` - 终身 Janaza 基金会员
3. `Lifetime Membership` - 终身会员
4. `Lifetime` - 终身（遗留值，默认值）

---

## 重要提示

1. **列名匹配**：系统使用灵活的匹配（不区分大小写，部分匹配）
   - "Name" 可以匹配："Name", "Member Name", "Full Name"
   - "Email" 可以匹配："Email", "Email Address", "E-mail"
   - "Subscription Type" 可以匹配："Subscription Type", "Type", "Subscription"

2. **电话号码格式**：必须包含国家代码
   - ✅ 正确：`+85291234567`, `+8613812345678`
   - ❌ 错误：`91234567`（缺少国家代码）

3. **日期格式**：
   - CSV: 使用 `YYYY-MM-DD` 格式（如 `2024-01-15`）
   - Excel: 可以使用 Excel 日期格式或文本格式 `YYYY-MM-DD`

4. **第一行必须是标题行**：包含列名

5. **空行会自动跳过**：系统会忽略空行

6. **重复的电子邮件**：系统会检测并报告重复的电子邮件地址

---

## Excel 格式示例

如果使用 Excel 文件（.xlsx 或 .xls），格式相同，只是保存在 Excel 文件中。第一行仍然是标题行，数据从第二行开始。

### Excel 表格示例（示例 2 的 Excel 版本）：

| Name | Email | Phone | Native | Status | Subscription Type | Subscription Year | Start Date |
|------|-------|-------|--------|--------|-------------------|-------------------|------------|
| Ahmed Khan | ahmed.khan@example.com | +85291234567 | Hong Kong | Active | Annual Member | 2024 | 2024-01-15 |
| Fatima Ali | fatima.ali@example.com | +85298765432 | India | Active | Lifetime Janaza Fund Member | 2024 | 2024-02-01 |
| Mohammed Rahman | mohammed.rahman@example.com | +85255512345 | Pakistan | Active | Lifetime Membership | 2024 | 2024-03-10 |

---

## 使用步骤

1. 选择一个示例格式（最简单、标准或完整）
2. 将示例数据复制到 Excel 或 CSV 文件中
3. 替换为您实际的成员数据
4. 保存文件（CSV 或 Excel 格式）
5. 在管理页面中点击 "Import Members" 按钮
6. 选择您创建的文件
7. 预览导入数据
8. 确认导入

