# Universe25 Simulator

ユニバース25実験に着想を得た、ブラウザ上で動くネズミコロニーのシミュレーターです。
初期投入ネズミ数、餌、巣、居住空間、時間速度、繁殖率、密度ストレス、寿命をトラックバーで調整しながら観察できます。

## Windows で動かす方法

### 1. Node.js をインストール

このアプリは Node.js と npm を使って起動します。
Windows に Node.js LTS が入っていない場合は、以下から LTS 版をインストールしてください。

https://nodejs.org/

### 2. リポジトリをクローン

PowerShell またはコマンドプロンプトで任意のフォルダに移動してから実行します。

```powershell
git clone https://github.com/freeonterminate/Universe26.git
cd Universe26
```

### 3. 起動

#### かんたん起動（推奨）

エクスプローラーでクローンしたフォルダを開き、以下のどちらかを実行してください。

- `start-universe25.bat`
- `start-universe25.ps1`

どちらも `node_modules` がない場合は自動で `npm install` を実行し、その後ブラウザを開いてシミュレーターを起動します。

PowerShell の実行ポリシーで `.ps1` が止まる場合は、`.bat` を使うか、PowerShell で次を実行してください。

```powershell
powershell -ExecutionPolicy Bypass -File .\start-universe25.ps1
```

#### 手動起動

```powershell
npm install
npm run start -- --open
```

ブラウザが自動で開かない場合は、ターミナルに表示される `http://localhost:5173/` などの Local URL を開いてください。

## 開発用コマンド

```powershell
npm install
npm run start
npm run build
npm run preview
```

## 機能

- 初期投入ネズミ数、餌の投入数、巣の数などをトラックバーで調整
- 1日が進む秒数を調整可能
- かわいいポリゴンねずみを Canvas に描画
- ネズミ数の推移を折れ線グラフで常時表示
- 初期投入数以上は青緑、下回ると赤でグラフを色分け
- 実験結果を X で共有
