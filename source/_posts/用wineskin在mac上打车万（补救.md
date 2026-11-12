---
title: 用wineskin在Mac上打车万（补救
tags:
  - wineskin
  - 东方
id: '52'
categories:
  - ACG
abbrlink: 4a72f5c3
date: 2023-02-23 22:39:52
cover: https://raw.githubusercontent.com/misaka-10201/img/main/117037544_p0.png
---

起因可能是最近在Apple Music上听的东方的歌太多了，没事就听没事就听，然后突然想起来，正好闲的没事，原也不想原，搭方块也不想搭方块，那就不如来打飞机吧（bushi）

其实是为了听歌（确信

## 感谢贴吧老哥

这里是用到的工具或资源列表，也是真的离谱，14年的资源现在拿出来还能接着用…还得是贴吧老哥

1.  贴吧老哥分享的dmg资源：[链接](https://tieba.baidu.com/p/3378471457?red_tag=2673241057#/)
2.  wineskin：[链接](https://github.com/Gcenx/WineskinServer)
3.  如果你是M系列的Mac，你还需要安装一下resetta2
4.  最好不要是最新版本操作系统（本文为Ventura13.0.1

## 获取资源

实现原理很简单，就是在Mac上用wineskin造一个能运行exe的Windows必要环境，wineskin官方在GitHub上也指出了M系列Mac使用的注意事项。至于为什么不用crossover，首先那玩意要钱，其次，那玩意要钱，就算找到了学习版，crossover是在你的Mac环境下直接创建了一个完整的Windows环境，确实可以干很多事情，但是相应的占用资源也增多了不少。我们只是为了打车万，没必要在你的Mac上再整一台Win出来（大概

先把老哥的分享和wineskin下载下来。

老哥的分享里都是东方正作的dmg文件，可能古早一些的Mac可以直接安装运行，那就省事太多了…如果你安装后发现无法运行，正常情况，接下来是wineskin的相应配置。

## Wineskin

下载最新的wineskin，安装完成后再安装里面需要的Engine和wrapper version，Engine记得要符合要求，比如M1以后的版本要求就不能低于WineCX20.0.4，同时注意安装64位的。

warpper目前好像没有什么降级的方法，我这个时间点安装的version是2.9.1.5，等会会有和老版本不同的地方，但是不影响最终实现…

随后就是create new blank wrapper，但我们现在还没有东方的游戏文件，也没什么exe让wine去运行啊，正好我们安装了老哥分享的dmg，打开app的包目录，你会发现这怎么和wineskin创建的app这么相似啊（乐）

可以试着用运行wineskin application的方式来运行，通常是木大的…

打开drive\_c这个目录，在Program Files里就有我们缺少的东方正作文件了，拷贝到我们自己创建的application的相同目录下面，同时可以看一下原本运行的是哪个exe文件，配置好启动路径后，test run一下，第一次可能会报错等等，别慌，再test一次，大概就ok了，开始苦手（

## 一些（小）问题

新老版本wrappar可能会导致app的启动画面里没有一个screen的选项，并没有什么影响，可能是先前需要手动配置的一些在新版本里更新成自动了吧（笑

如果你在车万的贴吧里已经下载好了exe文件，我并不是很推荐使用，在同样的条件下，dmg文件里扒出来的东方可以正常运行，而下载的exe版本总是莫名其妙的报错…要不是报错我也不至于去扒人家包里的文件



**东方的音乐真好听！**
