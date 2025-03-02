# Zoxcode  or Zoxide-like

Zoxcode, formally known as zoxide-like is cd and autojumping(an inspiration from [zoxide](https://github.com/ajeetdsouza/zoxide)) for VScode or formally Visual Studio Code. Easy Solution for jumping to different directories. Vim or neovim users familiar with :cd as well as cd and z  will find it a really useful utility.

## Preview

![zoxcode](https://github.com/HimadriChakra12/Zoxcode/raw/main/images/Code_Ipx5PQBpJo.png)

## Installation
You can install the extension from the [VSC Marketplace](https://github.com/HimadriChakra12/Zoxcode/releases) or from the [Releases](https://github.com/HimadriChakra12/Zoxcode/releases).

## Storage
It Creates a History.json file in the following directories:

In Linux: /home/him/.config/Code/User/globalStorage/himadrichakraborty.zoxide-like/history.json

In Windows : C:\Users\Him\AppData\Roaming\Code\User\globalStorage\himadrichakraborty.zoxide-like

## Usage

At First, You will get a clean popup having only "Enter path" option.

You can click "Enter path" or use "Escape" key to get into cd mode. Where you can cd into your desired path. In this case,the path will not be included. To include the path in the history.json for autojumping. You have to write it again in the cd mode.
That helps to justify what you want and what you don't want to include.

I didn't give it any keybindings cause there are to many keybinding that will overlap it. If using vim keybinding you can impliment this in "settings.json" or you can get into keyboard shortcuts to tweak it.
If you ever need to remove any path from it, you can edit the "history.json" file.
