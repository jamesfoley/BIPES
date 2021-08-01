'use strict';

class Tool {
  constructor () {

  }

  static bufferPush (code, callback) {
    let textArray;
    if (typeof code == 'object')
      textArray = code;
    else if (typeof code == 'string')
      textArray = code.replace(/\r\n|\n/gm, '\r').match(/(.|[\r]){1,10}/g);

    if (Channel ['websocket'].connected) {
      Channel ['websocket'].buffer_ = Channel ['websocket'].buffer_.concat(textArray);
      if (callback != undefined)
        Channel ['websocket'].completeBufferCallback.push(callback);
    /*}  else if (Channel ['webserial'].connected) {
      Channel ['webserial'].buffer_ = Channel ['webserial'].buffer_.concat(textArray);
      if (callback != undefined)
        Channel ['webserial'].completeBufferCallback.push(callback);
    } else if (Channel ['webbluetooth'].connected) {
      Channel ['webbluetooth'].buffer_ = Channel ['webbluetooth'].buffer_.concat(textArray);
      if (callback != undefined)
        Channel ['webbluetooth'].completeBufferCallback.push(callback);
    */} else
      BIPES ['notify'].send(MSG['notConnected']);
  }

  static runPython (code_) {
    // if (this.selector.value == "UNO") {
    //   alert("Generating code for Arduino Uno");
    //   var code = Blockly.Arduino.workspaceToCode(Code.workspace);

    //   return;
    // }
    let code = code_ == undefined ? Blockly.Python.workspaceToCode(Code.workspace) : code_;

    if (code) {
      this.bufferPush (`\x05${code}\x04`);
      BIPES ['progress'].start(Channel.websocket.buffer_.length);
    }
  }


  static stopPython () {
    //Send Ctrl+C to stop program
    this.bufferPush ('\x03');
  }



  static asleep (milliseconds) {
    //Avoid at all cost using this
    //New async sleep function, callend with async await(), which allows UI updates
	  return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
  static sleep (milliseconds) {
    //Avoid at all cost using this
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    }
    while (currentDate - date < milliseconds);
  }
  static updateSourceCode (code, file_name) {
    const reader = new FileReader();

    // This fires after the blob has been read/loaded.
    reader.addEventListener('loadend', (e) => {
      let text = e.srcElement.result;
      console.log(text);
      //For codemirror
      //var editor = CodeMirror.fromTextArea(Textarea);
      editor.getDoc().setValue(text);

      BIPES ['workspace'].content_file_name.value = file_name;
    });

    // Start reading the blob as text.
    reader.readAsText(code);
  }
  static blocksToPython() {
    let code = Blockly.Python.workspaceToCode(Code.workspace);
    editor.getDoc().setValue(code);
  }
  static decode_resp (data) {
    if (data[0] == 'W'.charCodeAt(0) && data[1] == 'B'.charCodeAt(0)) {
      let code = data[2] | (data[3] << 8);
      return code;
    } else
      return -1;
  }
  static unix2date (timestamp) {
    let date;
    if (timestamp == undefined)
      date = new Date (+new Date);
    else
      date = new Date(timestamp);
    let hours = date.getHours();
    let minutes = "0" + date.getMinutes();
    let seconds = "0" + date.getSeconds();
    return hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
  }
}

class files {
  constructor () {
    this.put_file_name = null;
    this.put_file_data = null;
    this.get_file_name = null;
    this.get_file_data = null;
    this.binary_state = 0;
    this.received_string = "";
    this.viewOnly = false;
  }


  static update_file_status (s) {
    BIPES ['workspace'].file_status.innerHTML = s;
  }


  put_file () {
    var dest_fname = this.put_file_name;
    var dest_fsize = this.put_file_data.length;

    // WEBREPL_FILE = "<2sBBQLH64s"
    var rec = new Uint8Array(2 + 1 + 1 + 8 + 4 + 2 + 64);
    rec[0] = 'W'.charCodeAt(0);
    rec[1] = 'A'.charCodeAt(0);
    rec[2] = 1; // put
    rec[3] = 0;
    rec[4] = 0; rec[5] = 0; rec[6] = 0; rec[7] = 0; rec[8] = 0; rec[9] = 0; rec[10] = 0; rec[11] = 0;
    rec[12] = dest_fsize & 0xff; rec[13] = (dest_fsize >> 8) & 0xff; rec[14] = (dest_fsize >> 16) & 0xff; rec[15] = (dest_fsize >> 24) & 0xff;
    rec[16] = dest_fname.length & 0xff; rec[17] = (dest_fname.length >> 8) & 0xff;
    for (var i = 0; i < 64; ++i) {
      rec[18 + i] = i < dest_fname.length ? rec[18 + i] = dest_fname.charCodeAt(i) : rec[18 + i] = 0;
    }

    // initiate put
    this.binary_state = 11;
    files.update_file_status ('Sending ' + this.put_file_name + '...');
    console.log(rec);
    Tool.bufferPush (rec);
  }

  get_ver () {
    // WEBREPL_REQ_S = "<2sBBQLH64s"
    var rec = new Uint8Array(2 + 1 + 1 + 8 + 4 + 2 + 64);
    rec[0] = 'W'.charCodeAt(0);
    rec[1] = 'A'.charCodeAt(0);
    rec[2] = 3; // GET_VER
    // rest of "rec" is zero

    // initiate GET_VER
    this.binary_state = 31;
    Tool.bufferPush(rec);
  }

  handle_put_file_select() {

    // The event holds a FileList object which is a list of File objects,
    // but we only support single file selection at the moment.
    let file_ = BIPES ['workspace'].put_file_select.files;
    // Get the file info and load its data.
    let f = file_[0];
    this.put_file_name = f.name;
    var reader = new FileReader();
    reader.onload = (e) => {
        this.put_file_data = new Uint8Array(e.target.result);
        BIPES ['workspace'].put_file_list.innerHTML = '' + encodeURIComponent(this.put_file_name) + ' - ' + this.put_file_data.length + ' bytes';
        BIPES ['workspace'].put_file_button.disabled = false;
    };
    reader.readAsArrayBuffer(f);
  }

  files_save_as () {

    //For codemirror
    var codeStr = editor.getDoc().getValue("\n");

    var bufCode = new Uint8Array(codeStr.length);
    for (var i=0, strLen=codeStr.length; i < strLen; i++) {
    bufCode[i] = codeStr.charCodeAt(i);
    }

    this.put_file_name = BIPES ['workspace'].file.value;
    this.put_file_data = bufCode;

    this.put_file ();
  }
  listFiles () {
    Tool.bufferPush ('import os; os.listdir()\r', files.updateTable.bind(this)); //Using ; to trigger only one ">>>"
  }
  run (file) {
    files.update_file_status('Executing  ' + file);

    //import only works once
    //In case module already loaded, unloaded it
    //to allow it to work all the time
    //fileS = file.split('.')[0];
    //Tool.bufferPush('import sys \r');
    //Tool.bufferPush('sys.modules.pop(\'' + fileS + '\')\r');
    //Tool.bufferPush('import ' + fileS + '\r');
    //Filename without .py
    Tool.bufferPush (`exec(open(\'./${file}\').read(),globals())\r`);
  }
  delete (file) {
    let msg = "Are you sure you want to delete " + file + "?";

    if (confirm(msg)) {
      let txt = "Will delete file " + file;
      Tool.bufferPush(`os.remove(\'${file}\')\r`, this.listFiles.bind(this));
      files.update_file_status('Deleted  ' + file);
    } else {
      let txt = "Delete aborted";
      files.update_file_status('Delete aborted for ' + file);
    }
  }
  files_view (file) {
    this.viewOnly=true;
    this.get_file(file);
    files.update_file_status('Downloading ' + file);
  }
   files_download (file) {

    this.viewOnly=false;
    this.get_file(file);
  }
  get_file (src_fname) {
    let rec = new Uint8Array(2 + 1 + 1 + 8 + 4 + 2 + 64);
    rec[0] = 'W'.charCodeAt(0);
    rec[1] = 'A'.charCodeAt(0);
    rec[2] = 2; // get
    rec[3] = 0;
    rec[4] = 0; rec[5] = 0; rec[6] = 0; rec[7] = 0; rec[8] = 0; rec[9] = 0; rec[10] = 0; rec[11] = 0;
    rec[12] = 0; rec[13] = 0; rec[14] = 0; rec[15] = 0;
    rec[16] = src_fname.length & 0xff; rec[17] = (src_fname.length >> 8) & 0xff;
    for (let i = 0; i < 64; ++i) {
        if (i < src_fname.length) {
            rec[18 + i] = src_fname.charCodeAt(i);
        } else {
            rec[18 + i] = 0;
        }
    }

    // initiate get
    this.binary_state = 21;
    this.get_file_name = src_fname;
    this.get_file_data = new Uint8Array(0);
    files.update_file_status('Getting ' + this.get_file_name + '...');
    Tool.bufferPush (rec);
  }

  static updateTable () {
    let match_ = this.received_string.match((/\[(.+)?\]/g));
    let treat_ = match_ [match_.length - 1].replace(/[\[\]]/g, '');
    let split_ = treat_.split('"'[0]);
    let file_ = eval("[" + split_ + "]");


    let fileTable = "Device File List at " + Tool.unix2date() + ": <br> <br> <table border=2> ";
    fileTable += "<tr><td><center>File</center></td><td><center>Actions</center></td><td>Run at boot?</td></tr>";
    let file;

    //Build table with files on device and actions
    for(var i=0, len=file_.length; i < len; i++) {

      //File name
      file = file_[i];
      fileTable += "<tr><td>" + file + "</td><td>";

      //Action buttons
      fileTable += '<input type=button value=Run onclick="Files.run(\'' + file + '\'); return false;" />';
      fileTable += '<input type=button value=Open onclick="Files.files_view(\'' + file + '\'); return false;" />';
      fileTable += '<input type=button value=Download onclick="Files.files_download(\'' + file + '\'); return false;" />';
      fileTable += '<input type=button value=Delete onclick="Files.delete(\'' + file + '\'); return false;" />';

      if ((file == "boot.py") || (file == "main.py"))
        fileTable += "</td><td><center>Yes</center></td></tr>";
      else
        fileTable += "</td><td><center>No</center></td></tr>";
    }

    fileTable += "</table>";
    let dom  = get("#fileList");
    dom.innerHTML = fileTable;
  }
}
