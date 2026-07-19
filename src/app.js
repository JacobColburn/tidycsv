/*
 * Shared page wiring for every TidyCSV tool page.
 * Each page defines window.TOOL = {
 *   run(inputText, opts) -> { output, message },   // throws Error with a friendly message on bad input
 *   downloadName: 'result.json',
 *   sample: '...'                                   // text loaded by the "Try sample" button
 * }
 * Options are read from any element with a data-opt attribute (checkbox or select).
 */
(function () {
  'use strict';

  var input = document.getElementById('input');
  var output = document.getElementById('output');
  var status = document.getElementById('status');
  var dropzone = document.getElementById('dropzone');
  var filePicker = document.getElementById('file-picker');

  function readOpts() {
    var opts = {};
    var els = document.querySelectorAll('[data-opt]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var value = el.type === 'checkbox' ? el.checked : el.value;
      if (value === '') continue; // "auto" selects
      if (value === '\\t') value = '\t';
      opts[el.getAttribute('data-opt')] = value;
    }
    return opts;
  }

  function run() {
    var text = input.value;
    if (!text.trim()) {
      output.value = '';
      status.textContent = '';
      status.className = 'status';
      return;
    }
    try {
      var result = window.TOOL.run(text, readOpts());
      output.value = result.output;
      status.textContent = result.message || 'Done.';
      status.className = 'status ok';
    } catch (err) {
      output.value = '';
      status.textContent = err.message;
      status.className = 'status error';
    }
  }

  function loadFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      input.value = reader.result;
      run();
    };
    reader.readAsText(file);
  }

  input.addEventListener('input', run);
  var optEls = document.querySelectorAll('[data-opt]');
  for (var i = 0; i < optEls.length; i++) {
    optEls[i].addEventListener('change', run);
  }

  if (dropzone) {
    ['dragover', 'dragenter'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropzone.classList.add('dragging');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropzone.classList.remove('dragging');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
    });
    dropzone.addEventListener('click', function () {
      filePicker.click();
    });
    filePicker.addEventListener('change', function () {
      if (filePicker.files.length) loadFile(filePicker.files[0]);
      filePicker.value = '';
    });
  }

  var copyBtn = document.getElementById('copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (!output.value) return;
      navigator.clipboard.writeText(output.value).then(function () {
        copyBtn.textContent = 'Copied!';
        setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });
  }

  var downloadBtn = document.getElementById('download');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function () {
      if (!output.value) return;
      var blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = window.TOOL.downloadName || 'tidycsv-output.txt';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  var sampleBtn = document.getElementById('sample');
  if (sampleBtn && window.TOOL.sample) {
    sampleBtn.addEventListener('click', function () {
      input.value = window.TOOL.sample;
      run();
    });
  }

  var clearBtn = document.getElementById('clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      run();
    });
  }
})();
