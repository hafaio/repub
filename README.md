rePub
=====

[![build](https://github.com/hafaio/repub/actions/workflows/node.js.yml/badge.svg)](https://github.com/hafaio/repub/actions/workflows/node.js.yml)
[![chrome](https://img.shields.io/badge/chrome-extension-orange)](https://chrome.google.com/webstore/detail/repub/blkjpagbjaekkpojgcgdapmikoaolpbl)
[![license](https://img.shields.io/github/license/hafaio/repub)](LICENSE)

A reMarkable ePub generator. This is essentially an open source version of
[Read on reMarkable](https://chrome.google.com/webstore/detail/read-on-remarkable/bfhkfdnddlhfippjbflipboognpdpoeh).
In contast to that extension, this will include images in the generated ePub
files. It also allows many more configuration options over the original
extension, and---being open source---can be modified to work better.

However this doesn't replicate the printer adapter, so if you want to upload
PDFs it still recommended to keep the Read on reMarkable extension for those
uploads.

Developing
----------

This is built with yarn, all development options in scripts should be pretty
self explanitory.  To help with debugging why images aren't included there's a
script for debugging `yarn dbg` that takes as input an mhtml file (created with
`save page as` in chrome) and prints out information abotu the found images.
This script needs to be built first with `yarn build:bundle`.

To Do
-----

- [ ] **document upload** - It'd be nice to implement better drag and drop
  upload than currently provided by remarkable. The two features I'm thinking are:
  1. support for all upload options already in the extension
  2. support for alternate formats (like markdown)
- [ ] **pin input** - the current pin field could be a little more visually
  similar to the way it's copied.
