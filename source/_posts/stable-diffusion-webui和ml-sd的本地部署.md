---
title: Stable-Diffusion-webui和ml-SD的本地部署
tags:
  - ml-stable-diffusion
  - Stable-Diffusion-webui
id: '28'
categories:
  - ACG
abbrlink: '82e04830'
date: 2023-02-18 03:07:58
cover: https://raw.githubusercontent.com/misaka-10201/img/main/00006-550923006.png
---

由于网站遭受到了管理人的错误处理，珍贵资源未能得以保留，鲁迅说过，网站不能空无一文（？，故水文一篇，赖以充数（逃

## 部署前准备

*   科学上网
*   能不用Mac就不用Mac
*   做好看鬼图的心理准备（确信

## ml-SD

本来事先是想着直接上SD的，但找参考时看到了ml-SD的[部署指南](https://blog.csdn.net/soulteary/article/details/128269466)，本着走前人走过的路的精神，就先试试ml-SD吧

客观来说，ml-SD在Mac上是要比SD有足够的优势的，毕竟是Apple改过的能动用M系列GPU的，比后面部署的SD-webui单纯用CPU搁那里算可快太多了，苦于不会写ui（fvv没有去看，摆烂人实锤），在实际使用方面还是webui更舒适一些。

### Conda安装

到[Conda官网](https://repo.anaconda.com/archive/)或[镜像站](https://mirrors.tuna.tsinghua.edu.cn/anaconda/archive/)下载，下载完后执行安装，建议用`vi ~/.condarc`对其进行换源，保护后面下载时不至于血压升高（

在完成 Conda 的安装之后，我们就可以用它来快速的创建不影响本地机器环境，只和项目关联的干净的 Python 运行环境了。

### 环境准备

```
conda create -n coreml_stable_diffusion python=3.8 -y
//初始化环境
conda activate coreml_stable_diffusion
//启动
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
//安装程序依赖的软件包
```

### 项目初始化

```
git clone https://github.com/apple/ml-stable-diffusion.git
//拉库
cd ml-stable-diffusion
pip install -r requirements.txt
//安装依赖
```

### 模型转换

现在我们有跑的环境了，缺少点来跑的model，上Huggingface注册一个账号，获取token后利用token登录，这样我们就可以从Huggingface上下载model了。和SD不一样，ml-SD好像只能运行转换格式后的model，我们需要转换 Huggingface 上的 PyTorch / TF 开放模型到 Apple Core ML 模型格式

```
python -m python_coreml_stable_diffusion.torch2coreml --convert-unet --convert-text-encoder --convert-vae-decoder --convert-safety-checker -o ./models
//默认下载CompVis/stable-diffusion-v1-4，如若想用其他模型，可自行添加--model-version参数
```

### 生成图片及参数录入优化

```
python -m python_coreml_stable_diffusion.pipeline --prompt "magic book on the table" -i ./models -o ./output --compute-unit ALL --seed 93
//画一本桌子上的魔法书
```

我们可以用gradio来创建一个 Web 界面，把 ML Stable Diffusion 的图片生成和 Web 界面“绑定”到一起（但不想看了，就没有后续力

### 感觉，快了，也没快多少（bushi

![](https://raw.githubusercontent.com/misaka-10201/img/main/00006-550923006.png)

真不戳（赞赏

## Stable-Diffusion-webui

在玩了几次ml-SD后，愈发感觉指南里的web过于直白，给不了多少自由度，自己又不想自己写，于是便决定用现成的webui，正好[官方文档](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/Installation-on-Apple-Silicon)里也有对Apple单独的部署指导，实际部署起来感觉比ml-SD更顺畅（？

### 过程

```
brew install cmake protobuf rust python@3.10 git wget
//前置依赖
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
//拉库
//放置下载的模型
cd stable-diffusion-webui
./webui.sh
//运行
```

事先装好Homebrew
