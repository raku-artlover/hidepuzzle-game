# HIDE PUZZLE

置いたピースの輪郭がグリッドへ溶け込み、見えなくなる記憶型パズルゲームです。

## Vercelへ公開

1. このリポジトリをVercelへImportします。
2. Application Presetが `Next.js` になっていることを確認してDeployします。
3. VercelのProject画面で **Storage → Browse Marketplace Storage** を開きます。
4. **Neon**を追加し、無料プランのPostgresデータベースをこのProjectへ接続します。
5. Neonが追加した環境変数に `DATABASE_URL` があることを確認します。
6. **Deployments**から最新DeploymentをRedeployします。

ランキングテーブルはAPIの初回アクセス時に自動作成されます。DAILYランキングは日本時間0時で切り替わります。

## ローカル起動

```bash
pnpm install
pnpm dev
```

ローカルでランキングも使う場合は、Neonの接続URLを `.env.local` の `DATABASE_URL` に設定します。接続URLはGitHubへアップロードしないでください。
