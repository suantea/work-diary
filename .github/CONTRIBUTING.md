# 贡献指南

感谢你考虑为 asuan 工作助手贡献代码！

## 开发流程

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feat/amazing-feature`)
3. 提交你的更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feat/amazing-feature`)
5. 创建一个 Pull Request

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `refactor:` 重构
- `perf:` 性能优化
- `chore:` 杂项

## 本地开发

```bash
npm install
npm run dev
npm run typecheck
```

## Pull Request 须知

- 确保代码通过类型检查 (`npm run typecheck`)
- 保持 PR 范围专注，一个 PR 只解决一个问题
