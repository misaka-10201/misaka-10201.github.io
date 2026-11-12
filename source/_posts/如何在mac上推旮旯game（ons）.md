---
title: 如何在Mac上推galgame（ONS）
tags:
  - Galgame
  - Onscripter
  - 缘の空
id: '112'
categories:
  - ACG
abbrlink: 981fdb07
date: 2023-03-17 14:52:58
cover: https://raw.githubusercontent.com/misaka-10201/img/main/83691218_p0.jpg
---

这几天属实闲的无聊，舍友的卧龙也打腻了。突然想着找几部galgame推一推，就比如美少女万拔镜（一部都没推过，久仰大名）仔细想想之前推过的gal确实不多，或者说是寥寥无几，至于为什么还惦记着推几部，可能是因为启蒙作是R18G类型的吧（笑  
（或者说还得是老东西够劲儿

之前在安卓上都是用krkr2，这次具体来说也没细找，好像是记得Mac上没有krkr，正好还有ons，一搜Mac还真能用，好多大作也都能玩（xx鸣泣之时），于是就愉快的开始ctrl到底了（bushi

![](https://raw.githubusercontent.com/misaka-10201/img/main/83691218_p0.jpg)

## 过程

1.  安装官方ons
2.  ons-GBK
3.  launcher
4.  ons的galgame资源
5.  ctrl（或者直接看CG

## 官方ons安装

首先，要有brew...

然后，在terminal里执行

```
brew install onscripter
```

等安装完就好了...

这时你找到路径（一般是`/opt/homebrew/Cellar/onscripter/20220816_1/bin`)，把onscripter拖到gal资源的文件夹里一般就能开始玩了，但是官方的并不支持中文...

除非你啃生肉，而且还是找到的生肉资源，不然文字部分一般都会是乱码，这时我们就要搞下一步的ONS-GBK

## ons-GBK

[Onscripter中文支持版，根据20150820版修改而来](https://github.com/ljkgpxs/onscripter-GBK-2015)，下载源码，随后在终端里cd到解压后的文件夹里，执行

```
make -f Makefile.MacOSX
```

然后你就会得到一个新的onscripter，把它替换掉原本的onscripter，这时就可以正常显示了。

## Launcher

终端开游戏还是过于生硬了，这时如果有个启动器则会使整个过程优雅许多，正好，官方也有提供的[启动器](https://tmkk.undo.jp/onscripter/)，感觉之前的步骤全都浪费表情了...虽然是Intel不是Apple，但这种也耗不了多少电。然后，以缘之空来举例，用启动器打开会出现没有画面显示的问题，具体原因尚且不明，但解决方法还是很轻松的，找到`onscripter.app`，显示包内容，把ons-GBK中生成的onscripter替换掉原本包内的文件。  
这下就完全体了🎉

![](https://raw.githubusercontent.com/misaka-10201/img/main/%E6%88%AA%E5%B1%8F2023-03-17%2014.43.00.png)

于是就先推完了沙耶之歌

如果你中途爆了好多错，不要急，没必要非得ons不可，这里是[指导文档](https://www.maemo.cc/2017/12/18/onscripter-gbk-for-mac.html)，实在搞不定，虚拟机曲线救国也不是不能用，最终目的是为了玩上🎮（看CG  
如果只是为了看CG好像也可以直接不用推（？

## 资源站

简单的都整完了，剩下这一个老大难（  
在这存一点下载ons资源的站点吧，感觉也不是很难找，而且照我的性格估计过几天就又懒得推了吧（逃

{% del [夏日社](https://www.summeread.com/)——部分付费，但是资源基本都能用（除了女装山脉 %} 

{% del [穹の下](https://soraacg.xyz)——没用过，感觉挺不错，下次注册个试试 %}

{% del [05](https://05fx.glitch.me/ONS游戏资源库/)——全免，直下，速度还不慢，就是目前下过的只有沙耶能用（ %}
