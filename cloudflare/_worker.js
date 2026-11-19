var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../../../../Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/base64-js/index.js
var require_base64_js = __commonJS({
  "../../../../../Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/base64-js/index.js"(exports) {
    "use strict";
    exports.byteLength = byteLength;
    exports.toByteArray = toByteArray;
    exports.fromByteArray = fromByteArray;
    var lookup = [];
    var revLookup = [];
    var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
    var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }
    var i;
    var len;
    revLookup["-".charCodeAt(0)] = 62;
    revLookup["_".charCodeAt(0)] = 63;
    function getLens(b64) {
      var len2 = b64.length;
      if (len2 % 4 > 0) {
        throw new Error("Invalid string. Length must be a multiple of 4");
      }
      var validLen = b64.indexOf("=");
      if (validLen === -1) validLen = len2;
      var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
      return [validLen, placeHoldersLen];
    }
    function byteLength(b64) {
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function _byteLength(b64, validLen, placeHoldersLen) {
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function toByteArray(b64) {
      var tmp;
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
      var curByte = 0;
      var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
      var i2;
      for (i2 = 0; i2 < len2; i2 += 4) {
        tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
        arr[curByte++] = tmp >> 16 & 255;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 2) {
        tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 1) {
        tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      return arr;
    }
    function tripletToBase64(num2) {
      return lookup[num2 >> 18 & 63] + lookup[num2 >> 12 & 63] + lookup[num2 >> 6 & 63] + lookup[num2 & 63];
    }
    function encodeChunk(uint8, start, end) {
      var tmp;
      var output = [];
      for (var i2 = start; i2 < end; i2 += 3) {
        tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
        output.push(tripletToBase64(tmp));
      }
      return output.join("");
    }
    function fromByteArray(uint8) {
      var tmp;
      var len2 = uint8.length;
      var extraBytes = len2 % 3;
      var parts = [];
      var maxChunkLength = 16383;
      for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
        parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
      }
      if (extraBytes === 1) {
        tmp = uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
        );
      } else if (extraBytes === 2) {
        tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
        );
      }
      return parts.join("");
    }
  }
});

// ../../../../../Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/ieee754/index.js
var require_ieee754 = __commonJS({
  "../../../../../Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/ieee754/index.js"(exports) {
    exports.read = function(buffer, offset, isLE, mLen, nBytes) {
      var e, m;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var nBits = -7;
      var i = isLE ? nBytes - 1 : 0;
      var d = isLE ? -1 : 1;
      var s = buffer[offset + i];
      i += d;
      e = s & (1 << -nBits) - 1;
      s >>= -nBits;
      nBits += eLen;
      for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      m = e & (1 << -nBits) - 1;
      e >>= -nBits;
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : (s ? -1 : 1) * Infinity;
      } else {
        m = m + Math.pow(2, mLen);
        e = e - eBias;
      }
      return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
    };
    exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
      var e, m, c;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
      var i = isLE ? 0 : nBytes - 1;
      var d = isLE ? 1 : -1;
      var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
      value = Math.abs(value);
      if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0;
        e = eMax;
      } else {
        e = Math.floor(Math.log(value) / Math.LN2);
        if (value * (c = Math.pow(2, -e)) < 1) {
          e--;
          c *= 2;
        }
        if (e + eBias >= 1) {
          value += rt / c;
        } else {
          value += rt * Math.pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
          e++;
          c /= 2;
        }
        if (e + eBias >= eMax) {
          m = 0;
          e = eMax;
        } else if (e + eBias >= 1) {
          m = (value * c - 1) * Math.pow(2, mLen);
          e = e + eBias;
        } else {
          m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
          e = 0;
        }
      }
      for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
      }
      e = e << mLen | m;
      eLen += mLen;
      for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
      }
      buffer[offset + i - d] |= s * 128;
    };
  }
});

// ../../../../../Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/buffer/index.js
var require_buffer = __commonJS({
  "../../../../../Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/buffer/index.js"(exports) {
    "use strict";
    var base64 = require_base64_js();
    var ieee754 = require_ieee754();
    var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
    exports.Buffer = Buffer5;
    exports.SlowBuffer = SlowBuffer;
    exports.INSPECT_MAX_BYTES = 50;
    var K_MAX_LENGTH = 2147483647;
    exports.kMaxLength = K_MAX_LENGTH;
    Buffer5.TYPED_ARRAY_SUPPORT = typedArraySupport();
    if (!Buffer5.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
      console.error(
        "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
      );
    }
    function typedArraySupport() {
      try {
        const arr = new Uint8Array(1);
        const proto = { foo: function() {
          return 42;
        } };
        Object.setPrototypeOf(proto, Uint8Array.prototype);
        Object.setPrototypeOf(arr, proto);
        return arr.foo() === 42;
      } catch (e) {
        return false;
      }
    }
    Object.defineProperty(Buffer5.prototype, "parent", {
      enumerable: true,
      get: function() {
        if (!Buffer5.isBuffer(this)) return void 0;
        return this.buffer;
      }
    });
    Object.defineProperty(Buffer5.prototype, "offset", {
      enumerable: true,
      get: function() {
        if (!Buffer5.isBuffer(this)) return void 0;
        return this.byteOffset;
      }
    });
    function createBuffer(length) {
      if (length > K_MAX_LENGTH) {
        throw new RangeError('The value "' + length + '" is invalid for option "size"');
      }
      const buf = new Uint8Array(length);
      Object.setPrototypeOf(buf, Buffer5.prototype);
      return buf;
    }
    function Buffer5(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        if (typeof encodingOrOffset === "string") {
          throw new TypeError(
            'The "string" argument must be of type string. Received type number'
          );
        }
        return allocUnsafe(arg);
      }
      return from(arg, encodingOrOffset, length);
    }
    Buffer5.poolSize = 8192;
    function from(value, encodingOrOffset, length) {
      if (typeof value === "string") {
        return fromString(value, encodingOrOffset);
      }
      if (ArrayBuffer.isView(value)) {
        return fromArrayView(value);
      }
      if (value == null) {
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof value === "number") {
        throw new TypeError(
          'The "value" argument must not be of type number. Received type number'
        );
      }
      const valueOf = value.valueOf && value.valueOf();
      if (valueOf != null && valueOf !== value) {
        return Buffer5.from(valueOf, encodingOrOffset, length);
      }
      const b = fromObject(value);
      if (b) return b;
      if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
        return Buffer5.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
      }
      throw new TypeError(
        "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
      );
    }
    Buffer5.from = function(value, encodingOrOffset, length) {
      return from(value, encodingOrOffset, length);
    };
    Object.setPrototypeOf(Buffer5.prototype, Uint8Array.prototype);
    Object.setPrototypeOf(Buffer5, Uint8Array);
    function assertSize(size) {
      if (typeof size !== "number") {
        throw new TypeError('"size" argument must be of type number');
      } else if (size < 0) {
        throw new RangeError('The value "' + size + '" is invalid for option "size"');
      }
    }
    function alloc(size, fill, encoding) {
      assertSize(size);
      if (size <= 0) {
        return createBuffer(size);
      }
      if (fill !== void 0) {
        return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
      }
      return createBuffer(size);
    }
    Buffer5.alloc = function(size, fill, encoding) {
      return alloc(size, fill, encoding);
    };
    function allocUnsafe(size) {
      assertSize(size);
      return createBuffer(size < 0 ? 0 : checked(size) | 0);
    }
    Buffer5.allocUnsafe = function(size) {
      return allocUnsafe(size);
    };
    Buffer5.allocUnsafeSlow = function(size) {
      return allocUnsafe(size);
    };
    function fromString(string, encoding) {
      if (typeof encoding !== "string" || encoding === "") {
        encoding = "utf8";
      }
      if (!Buffer5.isEncoding(encoding)) {
        throw new TypeError("Unknown encoding: " + encoding);
      }
      const length = byteLength(string, encoding) | 0;
      let buf = createBuffer(length);
      const actual = buf.write(string, encoding);
      if (actual !== length) {
        buf = buf.slice(0, actual);
      }
      return buf;
    }
    function fromArrayLike(array) {
      const length = array.length < 0 ? 0 : checked(array.length) | 0;
      const buf = createBuffer(length);
      for (let i = 0; i < length; i += 1) {
        buf[i] = array[i] & 255;
      }
      return buf;
    }
    function fromArrayView(arrayView) {
      if (isInstance(arrayView, Uint8Array)) {
        const copy = new Uint8Array(arrayView);
        return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
      }
      return fromArrayLike(arrayView);
    }
    function fromArrayBuffer(array, byteOffset, length) {
      if (byteOffset < 0 || array.byteLength < byteOffset) {
        throw new RangeError('"offset" is outside of buffer bounds');
      }
      if (array.byteLength < byteOffset + (length || 0)) {
        throw new RangeError('"length" is outside of buffer bounds');
      }
      let buf;
      if (byteOffset === void 0 && length === void 0) {
        buf = new Uint8Array(array);
      } else if (length === void 0) {
        buf = new Uint8Array(array, byteOffset);
      } else {
        buf = new Uint8Array(array, byteOffset, length);
      }
      Object.setPrototypeOf(buf, Buffer5.prototype);
      return buf;
    }
    function fromObject(obj) {
      if (Buffer5.isBuffer(obj)) {
        const len = checked(obj.length) | 0;
        const buf = createBuffer(len);
        if (buf.length === 0) {
          return buf;
        }
        obj.copy(buf, 0, 0, len);
        return buf;
      }
      if (obj.length !== void 0) {
        if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
          return createBuffer(0);
        }
        return fromArrayLike(obj);
      }
      if (obj.type === "Buffer" && Array.isArray(obj.data)) {
        return fromArrayLike(obj.data);
      }
    }
    function checked(length) {
      if (length >= K_MAX_LENGTH) {
        throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
      }
      return length | 0;
    }
    function SlowBuffer(length) {
      if (+length != length) {
        length = 0;
      }
      return Buffer5.alloc(+length);
    }
    Buffer5.isBuffer = function isBuffer(b) {
      return b != null && b._isBuffer === true && b !== Buffer5.prototype;
    };
    Buffer5.compare = function compare(a, b) {
      if (isInstance(a, Uint8Array)) a = Buffer5.from(a, a.offset, a.byteLength);
      if (isInstance(b, Uint8Array)) b = Buffer5.from(b, b.offset, b.byteLength);
      if (!Buffer5.isBuffer(a) || !Buffer5.isBuffer(b)) {
        throw new TypeError(
          'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
        );
      }
      if (a === b) return 0;
      let x = a.length;
      let y = b.length;
      for (let i = 0, len = Math.min(x, y); i < len; ++i) {
        if (a[i] !== b[i]) {
          x = a[i];
          y = b[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    Buffer5.isEncoding = function isEncoding(encoding) {
      switch (String(encoding).toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "latin1":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return true;
        default:
          return false;
      }
    };
    Buffer5.concat = function concat(list, length) {
      if (!Array.isArray(list)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
      }
      if (list.length === 0) {
        return Buffer5.alloc(0);
      }
      let i;
      if (length === void 0) {
        length = 0;
        for (i = 0; i < list.length; ++i) {
          length += list[i].length;
        }
      }
      const buffer = Buffer5.allocUnsafe(length);
      let pos = 0;
      for (i = 0; i < list.length; ++i) {
        let buf = list[i];
        if (isInstance(buf, Uint8Array)) {
          if (pos + buf.length > buffer.length) {
            if (!Buffer5.isBuffer(buf)) buf = Buffer5.from(buf);
            buf.copy(buffer, pos);
          } else {
            Uint8Array.prototype.set.call(
              buffer,
              buf,
              pos
            );
          }
        } else if (!Buffer5.isBuffer(buf)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        } else {
          buf.copy(buffer, pos);
        }
        pos += buf.length;
      }
      return buffer;
    };
    function byteLength(string, encoding) {
      if (Buffer5.isBuffer(string)) {
        return string.length;
      }
      if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
        return string.byteLength;
      }
      if (typeof string !== "string") {
        throw new TypeError(
          'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
        );
      }
      const len = string.length;
      const mustMatch = arguments.length > 2 && arguments[2] === true;
      if (!mustMatch && len === 0) return 0;
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "ascii":
          case "latin1":
          case "binary":
            return len;
          case "utf8":
          case "utf-8":
            return utf8ToBytes(string).length;
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return len * 2;
          case "hex":
            return len >>> 1;
          case "base64":
            return base64ToBytes(string).length;
          default:
            if (loweredCase) {
              return mustMatch ? -1 : utf8ToBytes(string).length;
            }
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer5.byteLength = byteLength;
    function slowToString(encoding, start, end) {
      let loweredCase = false;
      if (start === void 0 || start < 0) {
        start = 0;
      }
      if (start > this.length) {
        return "";
      }
      if (end === void 0 || end > this.length) {
        end = this.length;
      }
      if (end <= 0) {
        return "";
      }
      end >>>= 0;
      start >>>= 0;
      if (end <= start) {
        return "";
      }
      if (!encoding) encoding = "utf8";
      while (true) {
        switch (encoding) {
          case "hex":
            return hexSlice(this, start, end);
          case "utf8":
          case "utf-8":
            return utf8Slice(this, start, end);
          case "ascii":
            return asciiSlice(this, start, end);
          case "latin1":
          case "binary":
            return latin1Slice(this, start, end);
          case "base64":
            return base64Slice(this, start, end);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return utf16leSlice(this, start, end);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = (encoding + "").toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer5.prototype._isBuffer = true;
    function swap(b, n, m) {
      const i = b[n];
      b[n] = b[m];
      b[m] = i;
    }
    Buffer5.prototype.swap16 = function swap16() {
      const len = this.length;
      if (len % 2 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 16-bits");
      }
      for (let i = 0; i < len; i += 2) {
        swap(this, i, i + 1);
      }
      return this;
    };
    Buffer5.prototype.swap32 = function swap32() {
      const len = this.length;
      if (len % 4 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 32-bits");
      }
      for (let i = 0; i < len; i += 4) {
        swap(this, i, i + 3);
        swap(this, i + 1, i + 2);
      }
      return this;
    };
    Buffer5.prototype.swap64 = function swap64() {
      const len = this.length;
      if (len % 8 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 64-bits");
      }
      for (let i = 0; i < len; i += 8) {
        swap(this, i, i + 7);
        swap(this, i + 1, i + 6);
        swap(this, i + 2, i + 5);
        swap(this, i + 3, i + 4);
      }
      return this;
    };
    Buffer5.prototype.toString = function toString() {
      const length = this.length;
      if (length === 0) return "";
      if (arguments.length === 0) return utf8Slice(this, 0, length);
      return slowToString.apply(this, arguments);
    };
    Buffer5.prototype.toLocaleString = Buffer5.prototype.toString;
    Buffer5.prototype.equals = function equals(b) {
      if (!Buffer5.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
      if (this === b) return true;
      return Buffer5.compare(this, b) === 0;
    };
    Buffer5.prototype.inspect = function inspect() {
      let str = "";
      const max = exports.INSPECT_MAX_BYTES;
      str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
      if (this.length > max) str += " ... ";
      return "<Buffer " + str + ">";
    };
    if (customInspectSymbol) {
      Buffer5.prototype[customInspectSymbol] = Buffer5.prototype.inspect;
    }
    Buffer5.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
      if (isInstance(target, Uint8Array)) {
        target = Buffer5.from(target, target.offset, target.byteLength);
      }
      if (!Buffer5.isBuffer(target)) {
        throw new TypeError(
          'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
        );
      }
      if (start === void 0) {
        start = 0;
      }
      if (end === void 0) {
        end = target ? target.length : 0;
      }
      if (thisStart === void 0) {
        thisStart = 0;
      }
      if (thisEnd === void 0) {
        thisEnd = this.length;
      }
      if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
        throw new RangeError("out of range index");
      }
      if (thisStart >= thisEnd && start >= end) {
        return 0;
      }
      if (thisStart >= thisEnd) {
        return -1;
      }
      if (start >= end) {
        return 1;
      }
      start >>>= 0;
      end >>>= 0;
      thisStart >>>= 0;
      thisEnd >>>= 0;
      if (this === target) return 0;
      let x = thisEnd - thisStart;
      let y = end - start;
      const len = Math.min(x, y);
      const thisCopy = this.slice(thisStart, thisEnd);
      const targetCopy = target.slice(start, end);
      for (let i = 0; i < len; ++i) {
        if (thisCopy[i] !== targetCopy[i]) {
          x = thisCopy[i];
          y = targetCopy[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
      if (buffer.length === 0) return -1;
      if (typeof byteOffset === "string") {
        encoding = byteOffset;
        byteOffset = 0;
      } else if (byteOffset > 2147483647) {
        byteOffset = 2147483647;
      } else if (byteOffset < -2147483648) {
        byteOffset = -2147483648;
      }
      byteOffset = +byteOffset;
      if (numberIsNaN(byteOffset)) {
        byteOffset = dir ? 0 : buffer.length - 1;
      }
      if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
      if (byteOffset >= buffer.length) {
        if (dir) return -1;
        else byteOffset = buffer.length - 1;
      } else if (byteOffset < 0) {
        if (dir) byteOffset = 0;
        else return -1;
      }
      if (typeof val === "string") {
        val = Buffer5.from(val, encoding);
      }
      if (Buffer5.isBuffer(val)) {
        if (val.length === 0) {
          return -1;
        }
        return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
      } else if (typeof val === "number") {
        val = val & 255;
        if (typeof Uint8Array.prototype.indexOf === "function") {
          if (dir) {
            return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
          } else {
            return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
          }
        }
        return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
      }
      throw new TypeError("val must be string, number or Buffer");
    }
    function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
      let indexSize = 1;
      let arrLength = arr.length;
      let valLength = val.length;
      if (encoding !== void 0) {
        encoding = String(encoding).toLowerCase();
        if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
          if (arr.length < 2 || val.length < 2) {
            return -1;
          }
          indexSize = 2;
          arrLength /= 2;
          valLength /= 2;
          byteOffset /= 2;
        }
      }
      function read(buf, i2) {
        if (indexSize === 1) {
          return buf[i2];
        } else {
          return buf.readUInt16BE(i2 * indexSize);
        }
      }
      let i;
      if (dir) {
        let foundIndex = -1;
        for (i = byteOffset; i < arrLength; i++) {
          if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
            if (foundIndex === -1) foundIndex = i;
            if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
          } else {
            if (foundIndex !== -1) i -= i - foundIndex;
            foundIndex = -1;
          }
        }
      } else {
        if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
        for (i = byteOffset; i >= 0; i--) {
          let found = true;
          for (let j = 0; j < valLength; j++) {
            if (read(arr, i + j) !== read(val, j)) {
              found = false;
              break;
            }
          }
          if (found) return i;
        }
      }
      return -1;
    }
    Buffer5.prototype.includes = function includes(val, byteOffset, encoding) {
      return this.indexOf(val, byteOffset, encoding) !== -1;
    };
    Buffer5.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
    };
    Buffer5.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
    };
    function hexWrite(buf, string, offset, length) {
      offset = Number(offset) || 0;
      const remaining = buf.length - offset;
      if (!length) {
        length = remaining;
      } else {
        length = Number(length);
        if (length > remaining) {
          length = remaining;
        }
      }
      const strLen = string.length;
      if (length > strLen / 2) {
        length = strLen / 2;
      }
      let i;
      for (i = 0; i < length; ++i) {
        const parsed = parseInt(string.substr(i * 2, 2), 16);
        if (numberIsNaN(parsed)) return i;
        buf[offset + i] = parsed;
      }
      return i;
    }
    function utf8Write(buf, string, offset, length) {
      return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
    }
    function asciiWrite(buf, string, offset, length) {
      return blitBuffer(asciiToBytes(string), buf, offset, length);
    }
    function base64Write(buf, string, offset, length) {
      return blitBuffer(base64ToBytes(string), buf, offset, length);
    }
    function ucs2Write(buf, string, offset, length) {
      return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
    }
    Buffer5.prototype.write = function write(string, offset, length, encoding) {
      if (offset === void 0) {
        encoding = "utf8";
        length = this.length;
        offset = 0;
      } else if (length === void 0 && typeof offset === "string") {
        encoding = offset;
        length = this.length;
        offset = 0;
      } else if (isFinite(offset)) {
        offset = offset >>> 0;
        if (isFinite(length)) {
          length = length >>> 0;
          if (encoding === void 0) encoding = "utf8";
        } else {
          encoding = length;
          length = void 0;
        }
      } else {
        throw new Error(
          "Buffer.write(string, encoding, offset[, length]) is no longer supported"
        );
      }
      const remaining = this.length - offset;
      if (length === void 0 || length > remaining) length = remaining;
      if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
        throw new RangeError("Attempt to write outside buffer bounds");
      }
      if (!encoding) encoding = "utf8";
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "hex":
            return hexWrite(this, string, offset, length);
          case "utf8":
          case "utf-8":
            return utf8Write(this, string, offset, length);
          case "ascii":
          case "latin1":
          case "binary":
            return asciiWrite(this, string, offset, length);
          case "base64":
            return base64Write(this, string, offset, length);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return ucs2Write(this, string, offset, length);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    };
    Buffer5.prototype.toJSON = function toJSON() {
      return {
        type: "Buffer",
        data: Array.prototype.slice.call(this._arr || this, 0)
      };
    };
    function base64Slice(buf, start, end) {
      if (start === 0 && end === buf.length) {
        return base64.fromByteArray(buf);
      } else {
        return base64.fromByteArray(buf.slice(start, end));
      }
    }
    function utf8Slice(buf, start, end) {
      end = Math.min(buf.length, end);
      const res = [];
      let i = start;
      while (i < end) {
        const firstByte = buf[i];
        let codePoint = null;
        let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
        if (i + bytesPerSequence <= end) {
          let secondByte, thirdByte, fourthByte, tempCodePoint;
          switch (bytesPerSequence) {
            case 1:
              if (firstByte < 128) {
                codePoint = firstByte;
              }
              break;
            case 2:
              secondByte = buf[i + 1];
              if ((secondByte & 192) === 128) {
                tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                if (tempCodePoint > 127) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 3:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 4:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              fourthByte = buf[i + 3];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                  codePoint = tempCodePoint;
                }
              }
          }
        }
        if (codePoint === null) {
          codePoint = 65533;
          bytesPerSequence = 1;
        } else if (codePoint > 65535) {
          codePoint -= 65536;
          res.push(codePoint >>> 10 & 1023 | 55296);
          codePoint = 56320 | codePoint & 1023;
        }
        res.push(codePoint);
        i += bytesPerSequence;
      }
      return decodeCodePointsArray(res);
    }
    var MAX_ARGUMENTS_LENGTH = 4096;
    function decodeCodePointsArray(codePoints) {
      const len = codePoints.length;
      if (len <= MAX_ARGUMENTS_LENGTH) {
        return String.fromCharCode.apply(String, codePoints);
      }
      let res = "";
      let i = 0;
      while (i < len) {
        res += String.fromCharCode.apply(
          String,
          codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
        );
      }
      return res;
    }
    function asciiSlice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i] & 127);
      }
      return ret;
    }
    function latin1Slice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i]);
      }
      return ret;
    }
    function hexSlice(buf, start, end) {
      const len = buf.length;
      if (!start || start < 0) start = 0;
      if (!end || end < 0 || end > len) end = len;
      let out = "";
      for (let i = start; i < end; ++i) {
        out += hexSliceLookupTable[buf[i]];
      }
      return out;
    }
    function utf16leSlice(buf, start, end) {
      const bytes = buf.slice(start, end);
      let res = "";
      for (let i = 0; i < bytes.length - 1; i += 2) {
        res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
      }
      return res;
    }
    Buffer5.prototype.slice = function slice(start, end) {
      const len = this.length;
      start = ~~start;
      end = end === void 0 ? len : ~~end;
      if (start < 0) {
        start += len;
        if (start < 0) start = 0;
      } else if (start > len) {
        start = len;
      }
      if (end < 0) {
        end += len;
        if (end < 0) end = 0;
      } else if (end > len) {
        end = len;
      }
      if (end < start) end = start;
      const newBuf = this.subarray(start, end);
      Object.setPrototypeOf(newBuf, Buffer5.prototype);
      return newBuf;
    };
    function checkOffset(offset, ext, length) {
      if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
      if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
    }
    Buffer5.prototype.readUintLE = Buffer5.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      return val;
    };
    Buffer5.prototype.readUintBE = Buffer5.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        checkOffset(offset, byteLength2, this.length);
      }
      let val = this[offset + --byteLength2];
      let mul = 1;
      while (byteLength2 > 0 && (mul *= 256)) {
        val += this[offset + --byteLength2] * mul;
      }
      return val;
    };
    Buffer5.prototype.readUint8 = Buffer5.prototype.readUInt8 = function readUInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      return this[offset];
    };
    Buffer5.prototype.readUint16LE = Buffer5.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] | this[offset + 1] << 8;
    };
    Buffer5.prototype.readUint16BE = Buffer5.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] << 8 | this[offset + 1];
    };
    Buffer5.prototype.readUint32LE = Buffer5.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
    };
    Buffer5.prototype.readUint32BE = Buffer5.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
    };
    Buffer5.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
      const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
      return BigInt(lo) + (BigInt(hi) << BigInt(32));
    });
    Buffer5.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
      return (BigInt(hi) << BigInt(32)) + BigInt(lo);
    });
    Buffer5.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer5.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let i = byteLength2;
      let mul = 1;
      let val = this[offset + --i];
      while (i > 0 && (mul *= 256)) {
        val += this[offset + --i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer5.prototype.readInt8 = function readInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      if (!(this[offset] & 128)) return this[offset];
      return (255 - this[offset] + 1) * -1;
    };
    Buffer5.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset] | this[offset + 1] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer5.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset + 1] | this[offset] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer5.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
    };
    Buffer5.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
    };
    Buffer5.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
      return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
    });
    Buffer5.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = (first << 24) + // Overflow
      this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
    });
    Buffer5.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, true, 23, 4);
    };
    Buffer5.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, false, 23, 4);
    };
    Buffer5.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, true, 52, 8);
    };
    Buffer5.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, false, 52, 8);
    };
    function checkInt(buf, value, offset, ext, max, min) {
      if (!Buffer5.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
      if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
    }
    Buffer5.prototype.writeUintLE = Buffer5.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let mul = 1;
      let i = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer5.prototype.writeUintBE = Buffer5.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer5.prototype.writeUint8 = Buffer5.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer5.prototype.writeUint16LE = Buffer5.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer5.prototype.writeUint16BE = Buffer5.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer5.prototype.writeUint32LE = Buffer5.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset + 3] = value >>> 24;
      this[offset + 2] = value >>> 16;
      this[offset + 1] = value >>> 8;
      this[offset] = value & 255;
      return offset + 4;
    };
    Buffer5.prototype.writeUint32BE = Buffer5.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    function wrtBigUInt64LE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      return offset;
    }
    function wrtBigUInt64BE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset + 7] = lo;
      lo = lo >> 8;
      buf[offset + 6] = lo;
      lo = lo >> 8;
      buf[offset + 5] = lo;
      lo = lo >> 8;
      buf[offset + 4] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset + 3] = hi;
      hi = hi >> 8;
      buf[offset + 2] = hi;
      hi = hi >> 8;
      buf[offset + 1] = hi;
      hi = hi >> 8;
      buf[offset] = hi;
      return offset + 8;
    }
    Buffer5.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer5.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer5.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = 0;
      let mul = 1;
      let sub = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer5.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      let sub = 0;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer5.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
      if (value < 0) value = 255 + value + 1;
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer5.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer5.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer5.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      this[offset + 2] = value >>> 16;
      this[offset + 3] = value >>> 24;
      return offset + 4;
    };
    Buffer5.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      if (value < 0) value = 4294967295 + value + 1;
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    Buffer5.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    Buffer5.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    function checkIEEE754(buf, value, offset, ext, max, min) {
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
      if (offset < 0) throw new RangeError("Index out of range");
    }
    function writeFloat(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
      }
      ieee754.write(buf, value, offset, littleEndian, 23, 4);
      return offset + 4;
    }
    Buffer5.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
      return writeFloat(this, value, offset, true, noAssert);
    };
    Buffer5.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
      return writeFloat(this, value, offset, false, noAssert);
    };
    function writeDouble(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
      }
      ieee754.write(buf, value, offset, littleEndian, 52, 8);
      return offset + 8;
    }
    Buffer5.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
      return writeDouble(this, value, offset, true, noAssert);
    };
    Buffer5.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
      return writeDouble(this, value, offset, false, noAssert);
    };
    Buffer5.prototype.copy = function copy(target, targetStart, start, end) {
      if (!Buffer5.isBuffer(target)) throw new TypeError("argument should be a Buffer");
      if (!start) start = 0;
      if (!end && end !== 0) end = this.length;
      if (targetStart >= target.length) targetStart = target.length;
      if (!targetStart) targetStart = 0;
      if (end > 0 && end < start) end = start;
      if (end === start) return 0;
      if (target.length === 0 || this.length === 0) return 0;
      if (targetStart < 0) {
        throw new RangeError("targetStart out of bounds");
      }
      if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
      if (end < 0) throw new RangeError("sourceEnd out of bounds");
      if (end > this.length) end = this.length;
      if (target.length - targetStart < end - start) {
        end = target.length - targetStart + start;
      }
      const len = end - start;
      if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
        this.copyWithin(targetStart, start, end);
      } else {
        Uint8Array.prototype.set.call(
          target,
          this.subarray(start, end),
          targetStart
        );
      }
      return len;
    };
    Buffer5.prototype.fill = function fill(val, start, end, encoding) {
      if (typeof val === "string") {
        if (typeof start === "string") {
          encoding = start;
          start = 0;
          end = this.length;
        } else if (typeof end === "string") {
          encoding = end;
          end = this.length;
        }
        if (encoding !== void 0 && typeof encoding !== "string") {
          throw new TypeError("encoding must be a string");
        }
        if (typeof encoding === "string" && !Buffer5.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        if (val.length === 1) {
          const code = val.charCodeAt(0);
          if (encoding === "utf8" && code < 128 || encoding === "latin1") {
            val = code;
          }
        }
      } else if (typeof val === "number") {
        val = val & 255;
      } else if (typeof val === "boolean") {
        val = Number(val);
      }
      if (start < 0 || this.length < start || this.length < end) {
        throw new RangeError("Out of range index");
      }
      if (end <= start) {
        return this;
      }
      start = start >>> 0;
      end = end === void 0 ? this.length : end >>> 0;
      if (!val) val = 0;
      let i;
      if (typeof val === "number") {
        for (i = start; i < end; ++i) {
          this[i] = val;
        }
      } else {
        const bytes = Buffer5.isBuffer(val) ? val : Buffer5.from(val, encoding);
        const len = bytes.length;
        if (len === 0) {
          throw new TypeError('The value "' + val + '" is invalid for argument "value"');
        }
        for (i = 0; i < end - start; ++i) {
          this[i + start] = bytes[i % len];
        }
      }
      return this;
    };
    var errors = {};
    function E(sym, getMessage, Base) {
      errors[sym] = class NodeError extends Base {
        constructor() {
          super();
          Object.defineProperty(this, "message", {
            value: getMessage.apply(this, arguments),
            writable: true,
            configurable: true
          });
          this.name = `${this.name} [${sym}]`;
          this.stack;
          delete this.name;
        }
        get code() {
          return sym;
        }
        set code(value) {
          Object.defineProperty(this, "code", {
            configurable: true,
            enumerable: true,
            value,
            writable: true
          });
        }
        toString() {
          return `${this.name} [${sym}]: ${this.message}`;
        }
      };
    }
    E(
      "ERR_BUFFER_OUT_OF_BOUNDS",
      function(name) {
        if (name) {
          return `${name} is outside of buffer bounds`;
        }
        return "Attempt to access memory outside buffer bounds";
      },
      RangeError
    );
    E(
      "ERR_INVALID_ARG_TYPE",
      function(name, actual) {
        return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
      },
      TypeError
    );
    E(
      "ERR_OUT_OF_RANGE",
      function(str, range, input) {
        let msg = `The value of "${str}" is out of range.`;
        let received = input;
        if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
          received = addNumericalSeparator(String(input));
        } else if (typeof input === "bigint") {
          received = String(input);
          if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
            received = addNumericalSeparator(received);
          }
          received += "n";
        }
        msg += ` It must be ${range}. Received ${received}`;
        return msg;
      },
      RangeError
    );
    function addNumericalSeparator(val) {
      let res = "";
      let i = val.length;
      const start = val[0] === "-" ? 1 : 0;
      for (; i >= start + 4; i -= 3) {
        res = `_${val.slice(i - 3, i)}${res}`;
      }
      return `${val.slice(0, i)}${res}`;
    }
    function checkBounds(buf, offset, byteLength2) {
      validateNumber(offset, "offset");
      if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
        boundsError(offset, buf.length - (byteLength2 + 1));
      }
    }
    function checkIntBI(value, min, max, buf, offset, byteLength2) {
      if (value > max || value < min) {
        const n = typeof min === "bigint" ? "n" : "";
        let range;
        if (byteLength2 > 3) {
          if (min === 0 || min === BigInt(0)) {
            range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
          } else {
            range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
          }
        } else {
          range = `>= ${min}${n} and <= ${max}${n}`;
        }
        throw new errors.ERR_OUT_OF_RANGE("value", range, value);
      }
      checkBounds(buf, offset, byteLength2);
    }
    function validateNumber(value, name) {
      if (typeof value !== "number") {
        throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
      }
    }
    function boundsError(value, length, type) {
      if (Math.floor(value) !== value) {
        validateNumber(value, type);
        throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
      }
      if (length < 0) {
        throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
      }
      throw new errors.ERR_OUT_OF_RANGE(
        type || "offset",
        `>= ${type ? 1 : 0} and <= ${length}`,
        value
      );
    }
    var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
    function base64clean(str) {
      str = str.split("=")[0];
      str = str.trim().replace(INVALID_BASE64_RE, "");
      if (str.length < 2) return "";
      while (str.length % 4 !== 0) {
        str = str + "=";
      }
      return str;
    }
    function utf8ToBytes(string, units) {
      units = units || Infinity;
      let codePoint;
      const length = string.length;
      let leadSurrogate = null;
      const bytes = [];
      for (let i = 0; i < length; ++i) {
        codePoint = string.charCodeAt(i);
        if (codePoint > 55295 && codePoint < 57344) {
          if (!leadSurrogate) {
            if (codePoint > 56319) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            } else if (i + 1 === length) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            }
            leadSurrogate = codePoint;
            continue;
          }
          if (codePoint < 56320) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
            leadSurrogate = codePoint;
            continue;
          }
          codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
        } else if (leadSurrogate) {
          if ((units -= 3) > -1) bytes.push(239, 191, 189);
        }
        leadSurrogate = null;
        if (codePoint < 128) {
          if ((units -= 1) < 0) break;
          bytes.push(codePoint);
        } else if (codePoint < 2048) {
          if ((units -= 2) < 0) break;
          bytes.push(
            codePoint >> 6 | 192,
            codePoint & 63 | 128
          );
        } else if (codePoint < 65536) {
          if ((units -= 3) < 0) break;
          bytes.push(
            codePoint >> 12 | 224,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else if (codePoint < 1114112) {
          if ((units -= 4) < 0) break;
          bytes.push(
            codePoint >> 18 | 240,
            codePoint >> 12 & 63 | 128,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else {
          throw new Error("Invalid code point");
        }
      }
      return bytes;
    }
    function asciiToBytes(str) {
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        byteArray.push(str.charCodeAt(i) & 255);
      }
      return byteArray;
    }
    function utf16leToBytes(str, units) {
      let c, hi, lo;
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        if ((units -= 2) < 0) break;
        c = str.charCodeAt(i);
        hi = c >> 8;
        lo = c % 256;
        byteArray.push(lo);
        byteArray.push(hi);
      }
      return byteArray;
    }
    function base64ToBytes(str) {
      return base64.toByteArray(base64clean(str));
    }
    function blitBuffer(src, dst, offset, length) {
      let i;
      for (i = 0; i < length; ++i) {
        if (i + offset >= dst.length || i >= src.length) break;
        dst[i + offset] = src[i];
      }
      return i;
    }
    function isInstance(obj, type) {
      return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
    }
    function numberIsNaN(obj) {
      return obj !== obj;
    }
    var hexSliceLookupTable = (function() {
      const alphabet = "0123456789abcdef";
      const table = new Array(256);
      for (let i = 0; i < 16; ++i) {
        const i16 = i * 16;
        for (let j = 0; j < 16; ++j) {
          table[i16 + j] = alphabet[i] + alphabet[j];
        }
      }
      return table;
    })();
    function defineBigIntMethod(fn) {
      return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
    }
    function BufferBigIntNotDefined() {
      throw new Error("BigInt not supported");
    }
  }
});

// recepcion-correo/src/imap.js
var import_node_buffer = __toESM(require_buffer());
import { connect } from "cloudflare:sockets";
var ErrorImap = class extends Error {
};
var MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var codificador = new TextEncoder();
function fechaImap(dia) {
  const [a, m, d] = String(dia).slice(0, 10).split("-").map(Number);
  return `${d}-${MESES[m - 1]}-${a}`;
}
function utf7(nombre) {
  return nombre.replace(/&/g, "&-").replace(/[^\x20-\x7e]+/g, (s) => `&${import_node_buffer.Buffer.from(s, "utf16le").swap16().toString("base64").replace(/=+$/, "").replace(/\//g, ",")}-`);
}
function entreComillas(valor2, nombre) {
  const t = String(valor2 ?? "");
  if (/[\x00-\x1f\x7f]/.test(t)) throw new ErrorImap(`El dato "${nombre}" contiene caracteres no permitidos.`);
  if (/[^\x20-\x7e]/.test(t)) throw new ErrorImap(`El dato "${nombre}" solo puede llevar letras sin tilde, n\xFAmeros y s\xEDmbolos comunes.`);
  return `"${t.replace(/[\\"]/g, "\\$&")}"`;
}
var ClienteImap = class {
  /**
   * @param {{host: string, puerto: number, ssl: boolean, tiempoMs?: number, permitirSinCifrar?: boolean}} opciones
   */
  constructor({ host, puerto, ssl, tiempoMs = 45e3, permitirSinCifrar = false }) {
    this.host = host;
    this.puerto = puerto;
    this.ssl = ssl;
    this.tiempoMs = tiempoMs;
    this.permitirSinCifrar = permitirSinCifrar;
    this.socket = null;
    this.lector = null;
    this.escritor = null;
    this.trozos = [];
    this.total = 0;
    this.necesita = 0;
    this.contador = 0;
    this.espera = null;
    this.error = null;
    this.fase = "conectar";
  }
  // ---- Conexión ----
  async conectar() {
    const saludo = new Promise((resolver, rechazar) => {
      this.espera = { etiqueta: "*", sinEtiqueta: [], resolver, rechazar };
    });
    try {
      this.socket = connect({ hostname: this.host, port: this.puerto }, { secureTransport: this.ssl ? "on" : "starttls", allowHalfOpen: false });
    } catch (e) {
      throw this.traducir(e);
    }
    this.escuchar();
    this.socket.opened.catch((e) => this.fallar(e));
    const sinRespuesta = this.ssl ? `No hubo respuesta de ${this.host}:${this.puerto}. Revise el servidor y el puerto (con SSL normalmente es el 993).` : `No hubo respuesta de ${this.host}:${this.puerto}. Revise el servidor y el puerto.`;
    await this.conTiempo(saludo, sinRespuesta, Math.min(this.tiempoMs, 2e4));
    this.fase = "sesion";
    if (this.ssl) return;
    const capacidades = await this.comando("CAPABILITY");
    const texto = capacidades.sinEtiqueta.map((r) => r.partes[0]).join(" ").toUpperCase();
    if (texto.includes("STARTTLS")) {
      const pausada = new Promise((resolver) => {
        this.pausa = resolver;
      });
      try {
        await this.comando("STARTTLS");
      } catch (e) {
        this.fallar(e);
        throw this.error;
      }
      await pausada;
      this.subirATls();
      await this.comando("CAPABILITY");
      this.fase = "sesion";
    } else if (!this.permitirSinCifrar) {
      throw new ErrorImap('El servidor no ofrece conexi\xF3n cifrada. Active "Usar SSL / TLS" (normalmente puerto 993).');
    }
  }
  subirATls() {
    try {
      this.escritor.releaseLock();
    } catch {
    }
    this.trozos = [];
    this.total = 0;
    this.necesita = 0;
    this.fase = "starttls";
    try {
      this.socket = this.socket.startTls();
    } catch (e) {
      throw this.traducir(e);
    }
    this.escuchar();
    this.socket.opened.catch((e) => this.fallar(e));
  }
  escuchar() {
    const lector = this.socket.readable.getReader();
    this.lector = lector;
    this.escritor = this.socket.writable.getWriter();
    (async () => {
      try {
        for (; ; ) {
          const { value, done } = await lector.read();
          if (done) break;
          if (value && value.byteLength) this.alRecibir(import_node_buffer.Buffer.from(value));
          if (this.pausa && !this.espera) {
            const avisar = this.pausa;
            this.pausa = null;
            this.lector = null;
            lector.releaseLock();
            avisar();
            return;
          }
        }
        if (this.lector === lector) this.fallar(new ErrorImap("El servidor de correo cerr\xF3 la conexi\xF3n."));
      } catch (e) {
        if (this.lector === lector) this.fallar(e);
      }
    })();
  }
  traducir(e) {
    if (e instanceof ErrorImap) return e;
    const texto = String(e && e.message || e || "");
    if (/dns|resolve|lookup|ENOTFOUND|name not known/i.test(texto)) {
      return new ErrorImap(`No se encontr\xF3 el servidor "${this.host}". Revise el nombre.`);
    }
    if (this.fase === "conectar") {
      return new ErrorImap(
        this.ssl ? `No se pudo abrir una conexi\xF3n segura con ${this.host}:${this.puerto}. Revise el servidor y el puerto (con SSL normalmente es el 993). Si est\xE1n bien, el servidor no tiene un certificado v\xE1lido.` : `No se pudo conectar con ${this.host}:${this.puerto}. Revise el servidor y el puerto.`
      );
    }
    if (this.fase === "starttls") {
      return new ErrorImap(`No se pudo cifrar la conexi\xF3n con ${this.host} (STARTTLS): el certificado del servidor no es v\xE1lido.`);
    }
    return new ErrorImap(texto || "Error de conexi\xF3n con el servidor de correo.");
  }
  fallar(e) {
    if (this.error) return;
    this.error = this.traducir(e);
    this.cerrarSocket();
    const espera = this.espera;
    this.espera = null;
    if (espera) espera.rechazar(this.error);
  }
  cerrarSocket() {
    this.lector = null;
    if (this.socket) {
      try {
        this.socket.close().catch(() => {
        });
      } catch {
      }
    }
  }
  cerrar() {
    if (!this.error) this.error = new ErrorImap("Conexi\xF3n cerrada.");
    this.cerrarSocket();
  }
  conTiempo(promesa, mensaje, ms = this.tiempoMs) {
    let reloj;
    const limite = new Promise((_, rechazar) => {
      reloj = setTimeout(() => {
        const e = new ErrorImap(mensaje);
        this.fallar(e);
        rechazar(e);
      }, ms);
    });
    return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
  }
  // ---- Lectura de respuestas ----
  alRecibir(trozo) {
    this.trozos.push(trozo);
    this.total += trozo.length;
    if (this.total < this.necesita) return;
    let buf = this.trozos.length === 1 ? this.trozos[0] : import_node_buffer.Buffer.concat(this.trozos);
    for (; ; ) {
      const r = this.extraer(buf);
      if (!r) break;
      buf = buf.subarray(r.consumido);
      this.necesita = 0;
      this.alResponder(r.partes);
    }
    this.trozos = buf.length ? [buf] : [];
    this.total = buf.length;
  }
  /** Una respuesta completa: texto y, si trae literales `{n}`, los bytes que siguen. */
  extraer(buf) {
    const partes = [];
    let pos = 0;
    for (; ; ) {
      const fin = buf.indexOf("\r\n", pos);
      if (fin === -1) {
        this.necesita = buf.length + 1;
        return null;
      }
      const linea = buf.toString("utf8", pos, fin);
      const literal = /\{(\d+)\}$/.exec(linea);
      if (!literal) {
        partes.push(linea);
        return { partes, consumido: fin + 2 };
      }
      const largo = Number(literal[1]);
      const inicio = fin + 2;
      if (buf.length < inicio + largo) {
        this.necesita = inicio + largo + 2;
        return null;
      }
      partes.push(linea.slice(0, literal.index), import_node_buffer.Buffer.from(buf.subarray(inicio, inicio + largo)));
      pos = inicio + largo;
    }
  }
  alResponder(partes) {
    const espera = this.espera;
    if (!espera) return;
    const primera = partes[0];
    if (espera.etiqueta === "*") {
      this.espera = null;
      if (/^\* (OK|PREAUTH)/i.test(primera)) espera.resolver();
      else espera.rechazar(new ErrorImap(`El servidor de correo no acept\xF3 la conexi\xF3n: ${primera}`));
      return;
    }
    if (primera.startsWith(`${espera.etiqueta} `)) {
      this.espera = null;
      const m = /^\S+ (OK|NO|BAD)\s*(.*)$/i.exec(primera) || [];
      espera.resolver({ estado: (m[1] || "BAD").toUpperCase(), texto: m[2] || primera, sinEtiqueta: espera.sinEtiqueta });
    } else if (primera.startsWith("* ")) {
      espera.sinEtiqueta.push({ partes });
    }
  }
  /** Envía una orden y espera su respuesta final. Rechaza si el servidor contesta NO o BAD. */
  comando(orden, { permitirNo = false, tiempoMs = this.tiempoMs } = {}) {
    if (this.error) return Promise.reject(this.error);
    if (this.espera) return Promise.reject(new ErrorImap("Hay otra orden en curso."));
    this.contador += 1;
    const etiqueta = `A${String(this.contador).padStart(4, "0")}`;
    const respuesta = new Promise((resolver, rechazar) => {
      this.espera = { etiqueta, sinEtiqueta: [], resolver, rechazar };
    });
    this.escritor.write(codificador.encode(`${etiqueta} ${orden}\r
`)).catch((e) => this.fallar(e));
    return this.conTiempo(respuesta, "El servidor de correo tard\xF3 demasiado en responder.", tiempoMs).then((r) => {
      if (r.estado !== "OK" && !permitirNo) throw new ErrorImap(r.texto || "El servidor de correo rechaz\xF3 la orden.");
      return r;
    });
  }
  // ---- Operaciones ----
  async login(usuario, clave) {
    try {
      await this.comando(`LOGIN ${entreComillas(usuario, "usuario")} ${entreComillas(clave, "contrase\xF1a")}`);
    } catch (e) {
      if (e instanceof ErrorImap && !/caracteres|tilde|conexi/.test(e.message)) {
        const pista = /application-specific|app password|contrase.a de aplicaci/i.test(e.message) ? ' Gmail exige una "contrase\xF1a de aplicaci\xF3n" (no la contrase\xF1a normal de la cuenta).' : "";
        throw new ErrorImap(`El servidor rechaz\xF3 el usuario o la contrase\xF1a: ${e.message}${pista}`);
      }
      throw e;
    }
  }
  /** Abre la carpeta. `soloLectura` usa EXAMINE (no cambia nada en el buzón). */
  async seleccionar(carpeta, { soloLectura = false } = {}) {
    let r;
    try {
      r = await this.comando(`${soloLectura ? "EXAMINE" : "SELECT"} ${entreComillas(utf7(carpeta), "carpeta")}`);
    } catch (e) {
      throw new ErrorImap(`No se pudo abrir la carpeta "${carpeta}": ${e.message}`);
    }
    const lineas = r.sinEtiqueta.map((x) => x.partes[0]);
    const existe = lineas.map((l) => /^\* (\d+) EXISTS/i.exec(l)).find(Boolean);
    const validez = lineas.map((l) => /UIDVALIDITY (\d+)/i.exec(l)).find(Boolean);
    const next = lineas.map((l) => /UIDNEXT (\d+)/i.exec(l)).find(Boolean);
    return { uidNext: next ? Number(next[1]) : null, mensajes: existe ? Number(existe[1]) : 0, uidValidez: validez ? validez[1] : null };
  }
  /** UID de los mensajes que cumplen el criterio, de menor a mayor. */
  async buscar(criterio) {
    const r = await this.comando(`UID SEARCH ${criterio}`);
    const uids = [];
    for (const x of r.sinEtiqueta) {
      const m = /^\* SEARCH\b(.*)$/i.exec(x.partes[0]);
      if (m) {
        for (const n of m[1].trim().split(/\s+/)) if (/^\d+$/.test(n)) uids.push(Number(n));
      }
    }
    return [...new Set(uids)].sort((a, b) => a - b);
  }
  async tamano(uid) {
    const r = await this.comando(`UID FETCH ${Number(uid)} (RFC822.SIZE)`);
    const m = r.sinEtiqueta.map((x) => /RFC822\.SIZE (\d+)/i.exec(x.partes[0])).find(Boolean);
    return m ? Number(m[1]) : 0;
  }
  /** El mensaje completo, sin marcarlo como leído (BODY.PEEK). */
  async mensaje(uid) {
    const r = await this.comando(`UID FETCH ${Number(uid)} (BODY.PEEK[])`, { tiempoMs: Math.max(this.tiempoMs, 9e4) });
    for (const x of r.sinEtiqueta) {
      if (!/FETCH/i.test(x.partes[0])) continue;
      const cuerpo = x.partes.find((p) => import_node_buffer.Buffer.isBuffer(p));
      if (cuerpo) return cuerpo;
    }
    return null;
  }
  async marcarLeido(uid) {
    await this.comando(`UID STORE ${Number(uid)} +FLAGS.SILENT (\\Seen)`);
  }
  async salir() {
    if (!this.error && this.escritor) {
      try {
        await this.comando("LOGOUT", { permitirNo: true, tiempoMs: 5e3 });
      } catch {
      }
    }
    this.cerrar();
  }
};

// recepcion-correo/src/mime.js
var import_node_buffer2 = __toESM(require_buffer());
function decodificarTexto(buf, charset) {
  const nombre = String(charset || "utf-8").toLowerCase();
  try {
    return new TextDecoder(nombre === "us-ascii" ? "utf-8" : nombre).decode(buf);
  } catch {
    return buf.toString("latin1");
  }
}
function quotedPrintable(texto, esCabecera) {
  const t = esCabecera ? texto.replace(/_/g, " ") : texto.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < t.length; i += 1) {
    if (t[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
      bytes.push(parseInt(t.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(t.charCodeAt(i) & 255);
    }
  }
  return import_node_buffer2.Buffer.from(bytes);
}
function decodificarPalabras(valor2) {
  return String(valor2 || "").replace(/(=\?[^?]+\?[bBqQ]\?[^?]*\?=)\s+(?==\?)/g, "$1").replace(/=\?([^?*]+)(?:\*[^?]*)?\?([bBqQ])\?([^?]*)\?=/g, (_, charset, modo, dato) => {
    const buf = modo.toLowerCase() === "b" ? import_node_buffer2.Buffer.from(dato, "base64") : quotedPrintable(dato, true);
    return decodificarTexto(buf, charset);
  });
}
function separar(buf) {
  let corte = buf.indexOf("\r\n\r\n");
  let salto = 4;
  const alterno = buf.indexOf("\n\n");
  if (corte === -1 || alterno !== -1 && alterno < corte) {
    corte = alterno;
    salto = 2;
  }
  const bloque = corte === -1 ? buf.toString("latin1") : buf.toString("latin1", 0, corte);
  const cabeceras = {};
  for (const linea of bloque.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = linea.indexOf(":");
    if (i <= 0) continue;
    const nombre = linea.slice(0, i).trim().toLowerCase();
    if (!(nombre in cabeceras)) cabeceras[nombre] = linea.slice(i + 1).trim();
  }
  return { cabeceras, cuerpo: corte === -1 ? import_node_buffer2.Buffer.alloc(0) : buf.subarray(corte + salto) };
}
function parametros(cabecera) {
  const texto = String(cabecera || "");
  const valor2 = (texto.split(";")[0] || "").trim().toLowerCase();
  const crudos = {};
  const re = /;\s*([^=;\s]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]*))/g;
  let m;
  while (m = re.exec(texto)) {
    crudos[m[1].toLowerCase()] = m[2] !== void 0 ? m[2].replace(/\\(.)/g, "$1") : m[3].trim();
  }
  const params = {};
  const porPartes = {};
  for (const [clave, dato] of Object.entries(crudos)) {
    const p = /^([^*]+)\*(\d+)?(\*)?$/.exec(clave);
    if (!p) {
      if (!(clave in params)) params[clave] = decodificarPalabras(dato);
      continue;
    }
    (porPartes[p[1]] = porPartes[p[1]] || []).push({ orden: Number(p[2] || 0), codificado: !!p[3] || p[2] === void 0, dato });
  }
  for (const [clave, partes] of Object.entries(porPartes)) {
    partes.sort((a, b) => a.orden - b.orden);
    let charset = "utf-8";
    const bytes = [];
    partes.forEach((parte, i) => {
      let dato = parte.dato;
      if (parte.codificado) {
        if (i === 0) {
          const c = /^([^']*)'[^']*'(.*)$/.exec(dato);
          if (c) {
            charset = c[1] || "utf-8";
            dato = c[2];
          }
        }
        bytes.push(quotedPrintable(dato.replace(/%/g, "="), false));
      } else {
        bytes.push(import_node_buffer2.Buffer.from(dato, "latin1"));
      }
    });
    params[clave] = decodificarTexto(import_node_buffer2.Buffer.concat(bytes), charset);
  }
  return { valor: valor2, params };
}
function decodificarCuerpo(cuerpo, codificacion) {
  const tipo = String(codificacion || "7bit").trim().toLowerCase();
  if (tipo === "base64") return import_node_buffer2.Buffer.from(cuerpo.toString("latin1").replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
  if (tipo === "quoted-printable") return quotedPrintable(cuerpo.toString("latin1"), false);
  return cuerpo;
}
function partesDe(cuerpo, limite) {
  const marca = import_node_buffer2.Buffer.from(`--${limite}`);
  const partes = [];
  let inicio = -1;
  let pos = 0;
  for (; ; ) {
    const i = cuerpo.indexOf(marca, pos);
    if (i === -1) break;
    pos = i + marca.length;
    if (i !== 0 && cuerpo[i - 1] !== 10) continue;
    if (inicio !== -1) {
      let fin = i;
      if (cuerpo[fin - 1] === 10) fin -= 1;
      if (cuerpo[fin - 1] === 13) fin -= 1;
      partes.push(cuerpo.subarray(inicio, Math.max(inicio, fin)));
    }
    if (cuerpo[pos] === 45 && cuerpo[pos + 1] === 45) {
      inicio = -1;
      break;
    }
    const finLinea = cuerpo.indexOf("\n", pos);
    if (finLinea === -1) {
      inicio = -1;
      break;
    }
    inicio = finLinea + 1;
  }
  if (inicio !== -1) partes.push(cuerpo.subarray(inicio));
  return partes;
}
function adjuntos(mensaje, profundidad = 0, salida = []) {
  if (profundidad > 12 || salida.length > 500) return salida;
  const { cabeceras, cuerpo } = separar(mensaje);
  const tipo = parametros(cabeceras["content-type"] || "text/plain");
  if (tipo.valor.startsWith("multipart/") && tipo.params.boundary) {
    for (const parte of partesDe(cuerpo, tipo.params.boundary)) adjuntos(parte, profundidad + 1, salida);
    return salida;
  }
  const datos = decodificarCuerpo(cuerpo, cabeceras["content-transfer-encoding"]);
  if (tipo.valor === "message/rfc822") return adjuntos(datos, profundidad + 1, salida);
  const disposicion = parametros(cabeceras["content-disposition"] || "");
  const nombre = (disposicion.params.filename || tipo.params.name || "").split(/[\\/]/).pop().trim();
  const interesa = /(^|\/)(xml|pdf|zip|x-zip-compressed)$/.test(tipo.valor) || tipo.valor === "text/xml";
  if ((nombre || interesa) && datos.length > 0 && tipo.valor !== "text/plain" && tipo.valor !== "text/html") {
    salida.push({ nombre: nombre || `adjunto.${tipo.valor.split("/").pop().replace("x-zip-compressed", "zip")}`, tipo: tipo.valor, datos });
  } else if (nombre && datos.length > 0) {
    salida.push({ nombre, tipo: tipo.valor, datos });
  }
  return salida;
}
function claseDe(adjunto) {
  const nombre = adjunto.nombre.toLowerCase();
  const d = adjunto.datos;
  if (nombre.endsWith(".zip") || /zip/.test(adjunto.tipo) || d.length > 4 && d.readUInt32LE(0) === 67324752) return "zip";
  if (nombre.endsWith(".pdf") || adjunto.tipo === "application/pdf" || d.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (nombre.endsWith(".xml") || /xml$/.test(adjunto.tipo)) return "xml";
  const inicio = d.subarray(0, 200).toString("utf8").replace(/^﻿/, "").trimStart();
  return inicio.startsWith("<?xml") || /^<[A-Za-z]/.test(inicio) ? "xml" : null;
}
var ZipDemasiadoGrande = class extends Error {
};
async function inflar(datos, maximo) {
  const ds = new DecompressionStream("deflate-raw");
  const escritor = ds.writable.getWriter();
  escritor.write(datos).catch(() => {
  });
  escritor.close().catch(() => {
  });
  const lector = ds.readable.getReader();
  const trozos = [];
  let total = 0;
  for (; ; ) {
    const { value, done } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximo) {
      await lector.cancel().catch(() => {
      });
      throw new ZipDemasiadoGrande();
    }
    trozos.push(import_node_buffer2.Buffer.from(value));
  }
  return import_node_buffer2.Buffer.concat(trozos);
}
async function leerZip(buf, { maxArchivos = 2e3, maxBytes = 40 * 1024 * 1024, filtro = () => true } = {}) {
  const FIRMA_FIN = 101010256;
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i -= 1) {
    if (buf.readUInt32LE(i) === FIRMA_FIN) {
      fin = i;
      break;
    }
  }
  if (fin === -1) throw new Error("El archivo ZIP est\xE1 da\xF1ado o incompleto.");
  const cantidad = buf.readUInt16LE(fin + 10);
  let pos = buf.readUInt32LE(fin + 16);
  if (cantidad > maxArchivos) throw new Error("El archivo ZIP trae demasiados archivos.");
  const archivos = [];
  let total = 0;
  for (let n = 0; n < cantidad; n += 1) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 33639248) throw new Error("El archivo ZIP est\xE1 da\xF1ado.");
    const banderas = buf.readUInt16LE(pos + 8);
    const metodo = buf.readUInt16LE(pos + 10);
    const comprimido = buf.readUInt32LE(pos + 20);
    const largoNombre = buf.readUInt16LE(pos + 28);
    const largoExtra = buf.readUInt16LE(pos + 30);
    const largoComentario = buf.readUInt16LE(pos + 32);
    const local = buf.readUInt32LE(pos + 42);
    const nombre = buf.toString(banderas & 2048 ? "utf8" : "latin1", pos + 46, pos + 46 + largoNombre);
    pos += 46 + largoNombre + largoExtra + largoComentario;
    if (nombre.endsWith("/") || banderas & 1 || !filtro(nombre)) continue;
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 67324752) continue;
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const crudo = buf.subarray(inicio, inicio + comprimido);
    let datos;
    if (metodo === 0) datos = crudo;
    else if (metodo === 8) {
      try {
        datos = await inflar(crudo, Math.max(1, maxBytes - total));
      } catch (e) {
        if (e instanceof ZipDemasiadoGrande) throw new Error("El contenido del ZIP es demasiado grande.");
        continue;
      }
    } else continue;
    total += datos.length;
    if (total > maxBytes) throw new Error("El contenido del ZIP es demasiado grande.");
    archivos.push({ nombre: nombre.split(/[\\/]/).pop(), datos });
  }
  return archivos;
}

// recepcion-correo/src/xml.js
var ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function desescapar(t) {
  return t.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (todo, e) => {
    if (e[0] === "#") {
      const codigo = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 1114111 ? String.fromCodePoint(codigo) : "";
    }
    return ENTIDADES[e] ?? todo;
  });
}
function parsear(xml) {
  let t = String(xml);
  if (t.charCodeAt(0) === 65279) t = t.slice(1);
  const raiz = { nombre: "#raiz", hijos: [], texto: "" };
  const pila = [raiz];
  let i = 0;
  while (i < t.length) {
    const abre = t.indexOf("<", i);
    if (abre === -1) break;
    if (abre > i) pila[pila.length - 1].texto += desescapar(t.slice(i, abre));
    if (t.startsWith("<!--", abre)) {
      const fin = t.indexOf("-->", abre + 4);
      if (fin === -1) throw new Error("Comentario sin cerrar.");
      i = fin + 3;
    } else if (t.startsWith("<![CDATA[", abre)) {
      const fin = t.indexOf("]]>", abre + 9);
      if (fin === -1) throw new Error("CDATA sin cerrar.");
      pila[pila.length - 1].texto += t.slice(abre + 9, fin);
      i = fin + 3;
    } else if (t.startsWith("<?", abre)) {
      const fin = t.indexOf("?>", abre + 2);
      if (fin === -1) throw new Error("Instrucci\xF3n sin cerrar.");
      i = fin + 2;
    } else if (t.startsWith("<!", abre)) {
      throw new Error("El XML contiene una declaraci\xF3n DOCTYPE, que no se admite.");
    } else {
      const fin = t.indexOf(">", abre + 1);
      if (fin === -1) throw new Error("Etiqueta sin cerrar.");
      const cuerpo = t.slice(abre + 1, fin);
      if (cuerpo[0] === "/") {
        const nombre = cuerpo.slice(1).trim().split(":").pop();
        const actual = pila.pop();
        if (pila.length === 0 || actual.nombre !== nombre) throw new Error(`Cierre inesperado de <${nombre}>.`);
      } else {
        const autocierre = cuerpo.endsWith("/");
        const nombre = (/^[^\s/]+/.exec(cuerpo) || [""])[0].split(":").pop();
        if (!nombre) throw new Error("Etiqueta vac\xEDa.");
        const nodo = { nombre, hijos: [], texto: "" };
        pila[pila.length - 1].hijos.push(nodo);
        if (!autocierre) {
          if (pila.length > 200) throw new Error("El XML tiene demasiados niveles.");
          pila.push(nodo);
        }
      }
      i = fin + 1;
    }
  }
  if (pila.length !== 1 || raiz.hijos.length === 0) throw new Error("El XML est\xE1 incompleto.");
  return raiz.hijos[0];
}
var hijo = (nodo, nombre) => nodo ? nodo.hijos.find((h) => h.nombre === nombre) || null : null;
var hijos = (nodo, nombre) => nodo ? nodo.hijos.filter((h) => h.nombre === nombre) : [];
var valor = (nodo, ...camino) => {
  let actual = nodo;
  for (const paso of camino) actual = hijo(actual, paso);
  const t = actual ? actual.texto.trim() : "";
  return t || null;
};
var num = (nodo, ...camino) => {
  const n = Number(valor(nodo, ...camino));
  return Number.isFinite(n) ? n : 0;
};
var TIPOS_RAIZ = {
  FacturaElectronica: "FE",
  TiqueteElectronico: "TE",
  NotaCreditoElectronica: "NC",
  NotaDebitoElectronica: "ND",
  FacturaElectronicaCompra: "FEC",
  FacturaElectronicaExportacion: "FEE"
};
var TIPOS_CLAVE = { "01": "FE", "02": "ND", "03": "NC", "04": "TE", "08": "FEC", "09": "FEE" };
function persona(nodo) {
  if (!nodo) return { identificacion: null, nombre: null, nombreComercial: null, correo: null, telefono: null, direccion: null };
  const ubicacion = hijo(nodo, "Ubicacion");
  return {
    identificacion: valor(nodo, "Identificacion", "Numero") || valor(nodo, "IdentificacionExtranjero"),
    nombre: valor(nodo, "Nombre"),
    nombreComercial: valor(nodo, "NombreComercial"),
    correo: valor(nodo, "CorreoElectronico"),
    telefono: valor(nodo, "Telefono", "NumTelefono"),
    direccion: valor(ubicacion, "OtrasSenas")
  };
}
function fechaIso(texto) {
  if (!texto) return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}(?::\d{2})?))?/.exec(texto.trim());
  if (!m) return null;
  const hora = m[2] ? m[2].length === 5 ? `${m[2]}:00` : m[2] : "00:00:00";
  return `${m[1]}T${hora}-06:00`;
}
function leerComprobante(xml) {
  let raiz;
  try {
    raiz = parsear(xml);
  } catch (e) {
    throw new Error(`El archivo no es un XML v\xE1lido. ${e.message}`);
  }
  if (raiz.nombre === "MensajeHacienda") {
    const clave2 = valor(raiz, "Clave");
    if (!clave2) throw new Error("La respuesta de Hacienda no trae la clave del comprobante.");
    const codigo = valor(raiz, "Mensaje");
    return {
      clase: "respuesta",
      clave: clave2,
      estado: codigo === "1" ? "ACEPTADA" : codigo === "2" ? "ACEPTADA_PARCIALMENTE" : codigo === "3" ? "RECHAZADA" : "SIN RESPUESTA",
      detalle: valor(raiz, "DetalleMensaje")
    };
  }
  const clave = valor(raiz, "Clave");
  const tipoDocumento = TIPOS_RAIZ[raiz.nombre] || clave && TIPOS_CLAVE[clave.slice(29, 31)];
  if (!tipoDocumento || !hijo(raiz, "ResumenFactura")) {
    throw new Error("El XML no es un comprobante electr\xF3nico reconocido (factura, tiquete o nota).");
  }
  if (clave && !/^\d{50}$/.test(clave)) throw new Error("La clave del comprobante no tiene 50 d\xEDgitos.");
  const fechaEmision = fechaIso(valor(raiz, "FechaEmision"));
  if (!fechaEmision) throw new Error("El comprobante no trae una fecha de emisi\xF3n v\xE1lida.");
  const resumen = hijo(raiz, "ResumenFactura");
  const lineas = hijos(hijo(raiz, "DetalleServicio"), "LineaDetalle").map((l, indice) => {
    const impuestos = hijos(l, "Impuesto").map((imp) => ({ tarifa: imp ? num(imp, "Tarifa") : 0, monto: num(imp, "Monto") }));
    const comercial = hijo(l, "CodigoComercial");
    const cabys = valor(l, "CodigoCABYS") || (hijo(l, "Codigo") && hijo(l, "Codigo").hijos.length === 0 ? valor(l, "Codigo") : null);
    const montoTotal = num(l, "MontoTotal");
    const descuento = hijos(l, "Descuento").reduce((s, d) => s + num(d, "MontoDescuento"), 0);
    const impuesto = hijo(l, "ImpuestoNeto") ? num(l, "ImpuestoNeto") : impuestos.reduce((s, x) => s + x.monto, 0);
    const subtotal = hijo(l, "SubTotal") ? num(l, "SubTotal") : montoTotal - descuento;
    return {
      numeroLinea: num(l, "NumeroLinea") || indice + 1,
      codigoCabys: cabys,
      codigoComercial: valor(comercial, "Codigo"),
      descripcion: valor(l, "Detalle"),
      cantidad: num(l, "Cantidad"),
      unidadMedida: valor(l, "UnidadMedida"),
      precioUnitario: num(l, "PrecioUnitario"),
      descuento,
      subtotal,
      impuesto,
      tarifa: impuestos.length ? impuestos[0].tarifa : hijo(l, "Impuesto") ? 0 : null,
      montoTotalLinea: hijo(l, "MontoTotalLinea") ? num(l, "MontoTotalLinea") : subtotal + impuesto
    };
  });
  const medios = [
    ...hijos(raiz, "MedioPago").map((m) => m.texto.trim()),
    ...hijos(resumen, "MedioPago").map((m) => valor(m, "TipoMedioPago"))
  ].filter(Boolean);
  return {
    clase: "comprobante",
    tipoDocumento,
    clave,
    consecutivo: valor(raiz, "NumeroConsecutivo"),
    fechaEmision,
    emisor: persona(hijo(raiz, "Emisor")),
    receptor: persona(hijo(raiz, "Receptor")),
    condicionVenta: valor(raiz, "CondicionVenta"),
    medioPago: [...new Set(medios)].join(",") || null,
    codigoMoneda: valor(resumen, "CodigoTipoMoneda", "CodigoMoneda") || valor(resumen, "CodigoMoneda") || "CRC",
    tipoCambio: num(resumen, "CodigoTipoMoneda", "TipoCambio") || num(resumen, "TipoCambio") || 1,
    totalVenta: num(resumen, "TotalVenta"),
    totalDescuentos: num(resumen, "TotalDescuentos"),
    totalVentaNeta: num(resumen, "TotalVentaNeta"),
    totalImpuesto: num(resumen, "TotalImpuesto"),
    totalOtrosCargos: num(resumen, "TotalOtrosCargos"),
    totalComprobante: num(resumen, "TotalComprobante"),
    lineas
  };
}

// recepcion-correo/src/index.js
var MAX_MENSAJE = 15 * 1024 * 1024;
function sumarDias(dia, cantidad) {
  const d = /* @__PURE__ */ new Date(`${String(dia).slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + cantidad);
  return d.toISOString().slice(0, 10);
}
var hoy = () => new Date(Date.now() - 6 * 36e5).toISOString().slice(0, 10);
function validar(config2) {
  if (!config2 || !config2.servidorImap) throw new ErrorImap("Debe indicar el servidor IMAP.");
  if (!config2.usuario) throw new ErrorImap("Debe indicar el correo o usuario IMAP.");
  if (!config2.clave) throw new ErrorImap("Debe indicar la contrase\xF1a del correo.");
  const puerto = Number(config2.puerto || 993);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new ErrorImap("El puerto IMAP debe estar entre 1 y 65535.");
  return puerto;
}
async function conBuzon(config2, tarea) {
  const puerto = validar(config2);
  const cliente = new ClienteImap({
    host: config2.servidorImap,
    puerto,
    ssl: config2.usarSsl !== false,
    // Solo para pruebas contra un servidor local sin cifrar. En uso real déjelo en false:
    // así la contraseña nunca viaja sin cifrar.
    permitirSinCifrar: config2.permitirSinCifrar === true
  });
  try {
    await cliente.conectar();
    await cliente.login(config2.usuario, config2.clave);
    return await tarea(cliente);
  } finally {
    await cliente.salir();
  }
}
function probarConexion(config2) {
  return conBuzon(config2, (cliente) => cliente.seleccionar(config2.carpeta || "INBOX", { soloLectura: true }));
}
async function procesarMensaje(crudo, opciones = {}) {
  const o = { descargarXml: true, descargarPdf: true, procesarZip: true, ...opciones };
  const r = { comprobantes: [], respuestas: [], pdfs: [], errores: [], interesa: false };
  let lista;
  try {
    lista = adjuntos(crudo);
  } catch (e) {
    r.errores.push({ archivo: null, mensaje: `Correo ilegible: ${e.message}` });
    return r;
  }
  const xmls = [];
  const clasificar = (a) => {
    const clase = claseDe(a);
    if (clase === "xml") xmls.push(a);
    else if (clase === "pdf") r.pdfs.push({ nombre: a.nombre, datos: a.datos });
    return clase;
  };
  for (const a of lista) {
    if (clasificar(a) !== "zip" || !o.procesarZip) continue;
    r.interesa = true;
    try {
      for (const interno of await leerZip(a.datos, { filtro: (nombre) => /\.(xml|pdf)$/i.test(nombre) })) {
        clasificar({ nombre: interno.nombre, tipo: "", datos: interno.datos });
      }
    } catch (e) {
      r.errores.push({ archivo: a.nombre, mensaje: e.message });
    }
  }
  if (!o.descargarXml) xmls.length = 0;
  if (!o.descargarPdf) r.pdfs.length = 0;
  if (xmls.length || r.pdfs.length) r.interesa = true;
  for (const a of xmls) {
    const xml = a.datos.toString("utf8");
    try {
      const { clase, ...datos } = leerComprobante(xml);
      if (clase === "respuesta") r.respuestas.push({ archivo: a.nombre, xml, ...datos });
      else r.comprobantes.push({ archivo: a.nombre, xml, pdfs: [], ...datos });
    } catch (e) {
      if (!/no es un comprobante electrónico reconocido/.test(e.message)) r.errores.push({ archivo: a.nombre, mensaje: e.message });
    }
  }
  for (const pdf of r.pdfs) {
    const destino = r.comprobantes.length === 1 ? r.comprobantes[0] : r.comprobantes.find((c) => c.clave && pdf.nombre.includes(c.clave) || c.consecutivo && pdf.nombre.includes(c.consecutivo));
    if (destino) destino.pdfs.push(pdf);
  }
  return r;
}
var vacio = () => ({ comprobantes: [], respuestas: [], pdfs: [], errores: [], interesa: false });
async function leerUid(cliente, uid, config2) {
  if (await cliente.tamano(uid) > MAX_MENSAJE) {
    return { ...vacio(), errores: [{ archivo: null, mensaje: `Correo ${uid} omitido: pasa de ${MAX_MENSAJE / 1024 / 1024} MB.` }] };
  }
  const crudo = await cliente.mensaje(uid);
  return crudo ? procesarMensaje(crudo, config2) : vacio();
}
async function revisarBuzon(config2, estado, alRecibir, opciones = {}) {
  const maxCorreos = Math.max(1, Number(opciones.maxCorreos) || 20);
  const actual = {
    uidValidez: estado && estado.uidValidez || null,
    ultimoUid: Number(estado && estado.ultimoUid) || 0,
    revisarDesde: estado && estado.revisarDesde || hoy()
  };
  const resumen = { correos: 0, comprobantes: 0, respuestas: 0, procesados: 0, pendientes: 0, errores: [], error: null, estado: actual };
  try {
    await conBuzon(config2, async (cliente) => {
      const { uidValidez } = await cliente.seleccionar(config2.carpeta || "INBOX", { soloLectura: !config2.marcarComoLeido });
      if (actual.uidValidez && uidValidez && actual.uidValidez !== uidValidez) actual.ultimoUid = 0;
      actual.uidValidez = uidValidez;
      const criterio = `UID ${actual.ultimoUid + 1}:*` + (actual.ultimoUid ? "" : ` SINCE ${fechaImap(sumarDias(actual.revisarDesde, -1))}`);
      const uids = (await cliente.buscar(criterio)).filter((u) => u > actual.ultimoUid);
      const lote = uids.slice(0, maxCorreos);
      resumen.pendientes = uids.length - lote.length;
      for (const uid of lote) {
        const contenido = await leerUid(cliente, uid, config2);
        if (contenido.interesa) {
          const guardado = await alRecibir(contenido, { uid }) !== false;
          resumen.correos += 1;
          resumen.comprobantes += contenido.comprobantes.length;
          resumen.respuestas += contenido.respuestas.length;
          if (config2.marcarComoLeido && guardado && contenido.errores.length === 0) await cliente.marcarLeido(uid).catch(() => {
          });
        }
        if (opciones.reintentarErrores && contenido.errores.length) {
          throw new ErrorImap("Pendiente de revisar, correo " + uid + ": " + contenido.errores[0].mensaje);
        }
        for (const e of contenido.errores) resumen.errores.push({ uid, ...e });
        actual.ultimoUid = uid;
        resumen.procesados += 1;
        if (opciones.guardarEstado) await opciones.guardarEstado({ ...actual });
      }
    });
  } catch (e) {
    resumen.error = e.message;
  }
  return resumen;
}
async function buscarPorFechas(config2, desde, hasta, alRecibir, opciones = {}) {
  const maxCorreos = Math.max(1, Number(opciones.maxCorreos) || 20);
  const desdeUid = Number(opciones.desdeUid) || 0;
  const resumen = { correos: 0, comprobantes: 0, respuestas: 0, procesados: 0, pendientes: 0, terminado: false, ultimoUid: desdeUid, errores: [], error: null };
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(desde)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(hasta)) || hasta < desde) {
      throw new ErrorImap("Las fechas Desde y Hasta no son v\xE1lidas.");
    }
    await conBuzon(config2, async (cliente) => {
      const folder = await cliente.seleccionar(config2.carpeta || "INBOX", { soloLectura: true });
      resumen.validity = folder.uidValidez;
      const uids = (await cliente.buscar(`SINCE ${fechaImap(desde)} BEFORE ${fechaImap(sumarDias(hasta, 1))}`)).filter((u) => u > desdeUid);
      const lote = uids.slice(0, maxCorreos);
      resumen.pendientes = uids.length - lote.length;
      for (const uid of lote) {
        const contenido = await leerUid(cliente, uid, config2);
        if (contenido.interesa) {
          await alRecibir(contenido, { uid });
          resumen.correos += 1;
          resumen.comprobantes += contenido.comprobantes.length;
          resumen.respuestas += contenido.respuestas.length;
        }
        for (const e of contenido.errores) resumen.errores.push({ uid, ...e });
        resumen.ultimoUid = uid;
        resumen.procesados += 1;
        if (opciones.alAvanzar) await opciones.alAvanzar({ uid });
      }
      resumen.terminado = resumen.pendientes === 0;
    });
  } catch (e) {
    resumen.error = e.message;
  }
  return resumen;
}

// recepcion-correo/src/cifrado.js
var import_node_buffer3 = __toESM(require_buffer());
var codificador2 = new TextEncoder();
var llaves = /* @__PURE__ */ new Map();
function llave(secreto) {
  if (!secreto || String(secreto).length < 32) {
    throw new Error("Falta el secreto CLAVE_CIFRADO del Worker o es muy corto (m\xEDnimo 32 caracteres).");
  }
  if (!llaves.has(secreto)) {
    llaves.set(
      secreto,
      crypto.subtle.digest("SHA-256", codificador2.encode(secreto)).then((hash) => crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]))
    );
  }
  return llaves.get(secreto);
}
async function cifrar(texto, secreto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await llave(secreto), codificador2.encode(String(texto)));
  return `v1:${import_node_buffer3.Buffer.from(iv).toString("base64")}:${import_node_buffer3.Buffer.from(cifrado).toString("base64")}`;
}
async function descifrar(guardado, secreto) {
  const [version, iv, datos] = String(guardado || "").split(":");
  if (version !== "v1" || !iv || !datos) return null;
  try {
    const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: import_node_buffer3.Buffer.from(iv, "base64") }, await llave(secreto), import_node_buffer3.Buffer.from(datos, "base64"));
    return new TextDecoder().decode(plano);
  } catch {
    return null;
  }
}

// recepcion-correo/vault.js
var validEmail = (email) => typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
async function init(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS pos_gmail_accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE, credential TEXT NOT NULL)").run();
}
async function manageAccounts(body, env) {
  const db = env.DB;
  await init(db);
  if (body.action === "remove") {
    if (typeof body.id !== "string") throw Error("Seleccione una cuenta.");
    await db.prepare("DELETE FROM pos_gmail_accounts WHERE id=?").bind(body.id).run();
  } else if (body.action === "save") {
    if (!Array.isArray(body.accounts) || body.accounts.length > 3) throw Error("Se permiten hasta tres cuentas.");
    const writes = [];
    const hasPlan = await db.prepare("SELECT 1 FROM sqlite_master WHERE name='gmail_plan'").first();
    const plan = hasPlan && await db.prepare("SELECT minutes FROM gmail_plan WHERE id=1").first();
    for (const account of body.accounts) {
      if (!validEmail(account.email) || typeof account.password !== "string" || !account.password.trim() || account.password.length > 128) throw Error("Revise el correo y la contrase\xF1a de aplicaci\xF3n.");
      const encrypted = await cifrar(account.password.replace(/\s/g, ""), env.POS365_GMAIL_KEY);
      const id = crypto.randomUUID();
      writes.push(db.prepare("INSERT INTO pos_gmail_accounts(id,email,credential) VALUES (?,?,?)").bind(id, account.email.trim().toLowerCase(), encrypted));
      if (plan?.minutes) {
        const head = await probarConexion({ usuario: account.email.trim(), clave: account.password.replace(/\s/g, ""), servidorImap: "imap.gmail.com", puerto: 993 });
        if (!head.uidNext || !head.uidValidez) throw Error("Gmail no confirm\xF3 el punto inicial.");
        writes.push(db.prepare("INSERT INTO gmail_progress(id,validity,uid,since_day,due) VALUES(?,?,?,?,?)").bind(id, head.uidValidez, head.uidNext - 1, (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), Date.now()));
      }
    }
    if (writes.length) {
      await db.prepare("CREATE TRIGGER IF NOT EXISTS pos_gmail_limit BEFORE INSERT ON pos_gmail_accounts WHEN (SELECT count(*) FROM pos_gmail_accounts)>=3 BEGIN SELECT RAISE(ABORT,'limite'); END").run();
      try {
        await db.batch(writes);
      } catch {
        throw Error("No se guardaron las cuentas. Revise si ya existen o si se alcanz\xF3 el l\xEDmite de tres.");
      }
    }
  }
  const list = await db.prepare("SELECT id,email FROM pos_gmail_accounts ORDER BY rowid").all();
  return { accounts: list.results };
}
async function savedLogin(id, env) {
  const account = await env.DB.prepare("SELECT email,credential FROM pos_gmail_accounts WHERE id=?").bind(id).first();
  if (!account) throw Error("La conexi\xF3n fue quitada. Vuelva a abrir Cargas XML.");
  const password = await descifrar(account.credential, env.POS365_GMAIL_KEY);
  if (!password) throw Error("Revise la clave de cifrado del servidor antes de volver a consultar Gmail.");
  return { email: account.email, password };
}

// recepcion-correo/automatico.js
var minutesAllowed = [5, 10, 15, 20, 30, 60, 120, 180, 720, 1440];
async function schema(db) {
  if (await db.prepare("SELECT 1 FROM sqlite_master WHERE name='gmail_sync_counts' AND type='table'").first()) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_plan (id INTEGER PRIMARY KEY, minutes INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_progress (id TEXT PRIMARY KEY REFERENCES pos_gmail_accounts(id) ON DELETE CASCADE, validity TEXT, uid INTEGER NOT NULL, since_day TEXT NOT NULL, due INTEGER NOT NULL, lease TEXT, expires INTEGER DEFAULT 0, notice TEXT DEFAULT '')"),
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_arrivals (digest TEXT PRIMARY KEY, name TEXT NOT NULL, xml TEXT NOT NULL, response INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_completed (id TEXT PRIMARY KEY REFERENCES pos_gmail_accounts(id) ON DELETE CASCADE, completed_at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_sync_items (id TEXT NOT NULL REFERENCES pos_gmail_accounts(id) ON DELETE CASCADE, digest TEXT NOT NULL, PRIMARY KEY(id,digest))"),
    db.prepare("CREATE TABLE IF NOT EXISTS gmail_sync_counts (id TEXT PRIMARY KEY REFERENCES pos_gmail_accounts(id) ON DELETE CASCADE, completed_at INTEGER NOT NULL, xml_count INTEGER NOT NULL)")
  ]);
}
async function config(env, id) {
  const { email, password } = await savedLogin(id, env);
  return { usuario: email, clave: password, servidorImap: "imap.gmail.com", puerto: 993, usarSsl: true, descargarPdf: false };
}
async function status(db) {
  const plan = await db.prepare("SELECT minutes FROM gmail_plan WHERE id=1").first();
  const problem = await db.prepare("SELECT email,notice FROM gmail_progress JOIN pos_gmail_accounts USING(id) WHERE notice<>'' LIMIT 1").first();
  const accounts = await db.prepare("SELECT a.email,c.completed_at,n.xml_count FROM pos_gmail_accounts a LEFT JOIN gmail_completed c ON c.id=a.id LEFT JOIN gmail_sync_counts n ON n.id=a.id AND n.completed_at=c.completed_at ORDER BY a.rowid").all();
  return { completed: accounts.results, minutes: plan?.minutes || 0, notice: problem ? problem.email + " \xB7 " + problem.notice : "" };
}
async function autoAction(body, env) {
  const db = env.DB;
  await schema(db);
  if (body.action === "auto-list") return status(db);
  if (body.action === "auto-checkpoint") {
    if (!Number.isSafeInteger(body.uid) || body.uid <= 0 || !/^\d+$/.test(body.validity) || !/^\d{4}-\d{2}-\d{2}$/.test(body.day)) throw Error("Punto de carga inv\xE1lido.");
    await db.prepare(`INSERT INTO gmail_progress(id,validity,uid,since_day,due)
      SELECT id,?,?,?,0 FROM pos_gmail_accounts WHERE id=? AND NOT EXISTS(SELECT 1 FROM gmail_plan)
      ON CONFLICT(id) DO UPDATE SET validity=excluded.validity,uid=excluded.uid,since_day=excluded.since_day
      WHERE excluded.uid>gmail_progress.uid AND excluded.validity=gmail_progress.validity`).bind(body.validity, body.uid, body.day, body.id).run();
    return { ok: true };
  }
  if (body.action === "auto-set") {
    const minutes = body.minutes;
    if (minutes !== 0 && !minutesAllowed.includes(minutes)) throw Error("Seleccione un intervalo v\xE1lido.");
    const rows = (await db.prepare("SELECT id FROM pos_gmail_accounts").all()).results;
    if (minutes && !rows.length) throw Error("Guarde primero una cuenta de Gmail.");
    const writes = [];
    if (minutes) for (const { id } of rows) {
      if (await db.prepare("SELECT id FROM gmail_progress WHERE id=?").bind(id).first()) continue;
      const head = await probarConexion(await config(env, id));
      if (!head.uidValidez || !head.uidNext) throw Error("Gmail no confirm\xF3 el punto inicial.");
      const prior = typeof body.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.since) && body.since <= (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) ? body.since : null;
      writes.push(db.prepare("INSERT OR IGNORE INTO gmail_progress(id,validity,uid,since_day,due) VALUES(?,?,?,?,?)").bind(id, head.uidValidez, prior ? 0 : head.uidNext - 1, prior || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), Date.now()));
    }
    writes.push(db.prepare("INSERT INTO gmail_plan VALUES(1,?) ON CONFLICT(id) DO UPDATE SET minutes=excluded.minutes").bind(minutes));
    writes.push(db.prepare("UPDATE gmail_progress SET due=?,lease=NULL,expires=0").bind(Date.now()));
    await db.batch(writes);
    return status(db);
  }
  if (body.action === "auto-files") {
    const row = await db.prepare("SELECT rowid AS seq,digest,name,xml FROM gmail_arrivals WHERE rowid>? AND response=? ORDER BY rowid LIMIT 1").bind(Number(body.after) || 0, body.response ? 1 : 0).first();
    return { row };
  }
  if (body.action === "auto-ack") {
    await db.prepare("DELETE FROM gmail_arrivals WHERE digest=?").bind(String(body.digest)).run();
    return { ok: true };
  }
  throw Error("Acci\xF3n desconocida.");
}
async function autoTick(request, env) {
  if (request.method !== "POST" || !env.POS365_SYNC_TRIGGER || request.headers.get("Authorization") !== "Bearer " + env.POS365_SYNC_TRIGGER) return new Response(null, { status: 403 });
  const db = env.DB;
  if (!await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='gmail_plan'").first()) return new Response(null, { status: 204 });
  const plan = await db.prepare("SELECT minutes FROM gmail_plan WHERE id=1 AND minutes>0").first();
  if (!plan) return new Response(null, { status: 204 });
  await schema(db);
  const now = Date.now();
  const jobs = (await db.prepare("SELECT p.* FROM gmail_progress p JOIN pos_gmail_accounts a ON a.id=p.id WHERE due<=? AND expires<=? ORDER BY due").bind(now, now).all()).results;
  for (const job of jobs) {
    const lease = crypto.randomUUID();
    const claim = await db.prepare("UPDATE gmail_progress SET lease=?,expires=? WHERE id=? AND expires<=? AND due<=? AND (SELECT minutes FROM gmail_plan WHERE id=1)=?").bind(lease, now + 24e4, job.id, now, now, plan.minutes).run();
    if (!claim.meta.changes) continue;
    let delay = plan.minutes * 6e4, notice = "", complete = false;
    try {
      const result = await revisarBuzon(await config(env, job.id), { uidValidez: job.validity, ultimoUid: job.uid, revisarDesde: job.since_day }, async (content) => {
        for (const [response, items] of [[0, content.comprobantes], [1, content.respuestas]]) {
          for (const item of items) {
            const bytes = new TextEncoder().encode(item.xml);
            const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (v) => v.toString(16).padStart(2, "0")).join("");
            const arrival = db.prepare("INSERT OR IGNORE INTO gmail_arrivals(digest,name,xml,response) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM gmail_progress WHERE id=? AND lease=?)").bind(digest, item.archivo, item.xml, response, job.id, lease);
            await db.batch([arrival, db.prepare("INSERT OR IGNORE INTO gmail_sync_items(id,digest) SELECT ?,? WHERE changes()=1").bind(job.id, digest)]);
          }
        }
      }, { maxCorreos: 5, reintentarErrores: true, guardarEstado: async (state) => {
        const saved = await db.prepare("UPDATE gmail_progress SET validity=?,uid=? WHERE id=? AND lease=?").bind(state.uidValidez, state.ultimoUid, job.id, lease).run();
        if (!saved.meta.changes) throw Error("La programaci\xF3n cambi\xF3.");
      } });
      if (result.error) throw Error(result.error);
      if (result.pendientes) delay = 6e4;
      complete = !result.pendientes && !result.errores.length;
    } catch (error) {
      delay = 6e4;
      notice = error.message;
    }
    const finished = Date.now(), writes = [];
    if (complete) {
      writes.push(db.prepare(`INSERT INTO gmail_completed(id,completed_at)
        SELECT id,? FROM gmail_progress WHERE id=? AND lease=?
        ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at`).bind(finished, job.id, lease));
      writes.push(db.prepare(`INSERT INTO gmail_sync_counts(id,completed_at,xml_count)
        SELECT p.id,?,(SELECT COUNT(*) FROM gmail_sync_items i WHERE i.id=p.id)
        FROM gmail_progress p WHERE p.id=? AND p.lease=?
        ON CONFLICT(id) DO UPDATE SET completed_at=excluded.completed_at,xml_count=excluded.xml_count`).bind(finished, job.id, lease));
      writes.push(db.prepare("DELETE FROM gmail_sync_items WHERE id=? AND EXISTS(SELECT 1 FROM gmail_progress WHERE id=? AND lease=?)").bind(job.id, job.id, lease));
    }
    writes.push(db.prepare("UPDATE gmail_progress SET due=?,lease=NULL,expires=0,notice=? WHERE id=? AND lease=?").bind(finished + delay, notice, job.id, lease));
    await db.batch(writes);
  }
  return new Response(null, { status: 204 });
}

// recepcion-correo/gmail.js
async function gmailRequest(request, env) {
  const reply = (value, status2 = 200) => Response.json(value, { status: status2, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST" || request.headers.get("Origin") !== new URL(request.url).origin || !request.headers.get("Content-Type")?.startsWith("application/json")) return reply({ error: "Solicitud no permitida." }, 403);
  try {
    const body = await request.json(), { action, from, to, cursor = 0 } = body;
    if (typeof action === "string" && action.startsWith("auto-")) return reply(await autoAction(body, env));
    if (["list", "save", "remove"].includes(action)) {
      if (action === "save" && body.accounts?.length && (!env.POS365_GMAIL_KEY || env.POS365_GMAIL_KEY.length < 32)) return reply({ error: "Configure el secreto POS365_GMAIL_KEY en Cloudflare para guardar la cuenta." }, 503);
      return reply(await manageAccounts(body, env));
    }
    const { email, password } = body.id ? await savedLogin(body.id, env) : body;
    if (typeof email !== "string" || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== "string" || !password.trim() || password.length > 128) return reply({ error: "Revise el correo y la contrase\xF1a de aplicaci\xF3n." }, 400);
    const config2 = { usuario: email, clave: password.replace(/\s/g, ""), servidorImap: "imap.gmail.com", puerto: 993, usarSsl: true, carpeta: "INBOX", descargarPdf: false };
    if (action === "test") return reply(await probarConexion(config2));
    if (action !== "sync" || !Number.isSafeInteger(cursor) || cursor < 0 || ![from, to].every((x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x)) || from > to) return reply({ error: "Revise las fechas de recepci\xF3n." }, 400);
    const files = [];
    const result = await buscarPorFechas(config2, from, to, async (content) => {
      for (const entry of [...content.comprobantes, ...content.respuestas]) {
        files.push({ name: entry.archivo, xml: entry.xml });
      }
    }, { desdeUid: cursor, maxCorreos: 1 });
    if (result.error) return reply({ error: result.error }, 502);
    return reply({ files, validity: result.validity, processed: result.procesados, cursor: result.ultimoUid, done: result.terminado, errors: result.errores.length });
  } catch (error) {
    return reply({ error: error.message || "No se pudo consultar Gmail." }, 502);
  }
}
// Google Identity Services authenticates the three approved workspace accounts.
const personalEmail = 'luigivl@gmail.com';
const allowed = new Set(['carlosxu@dcasa-cr.com','ruben@dcasa-cr.com','yuna@dcasa-cr.com',personalEmail]);
const json = (value, status=200) => Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const decode = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
const clientId = '181334796897-b80g1cjtlm62gb31ljc6f2n47bfhfrq7.apps.googleusercontent.com';
const sessionCookie = '__Host-cedi_session';
const nonceCookie = '__Host-cedi_nonce';
function cookie(request, name) {
  return (request.headers.get('Cookie') || '').split(';').map(entry => entry.trim())
    .find(entry => entry.startsWith(name + '='))?.slice(name.length + 1);
}
function setCookie(name, value, age) {
  return name + '=' + value + '; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + age;
}
let keys, expiry = 0;
async function verify(token, nonce, failure = {}) {
  const fail = message => { failure.message = message; return null; };
  try {
    if (!token || token.length > 3800) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [head, body, signature] = parts;
    const parse = part => JSON.parse(new TextDecoder().decode(decode(part)));
    const header = parse(head), claims = parse(body), now = Date.now()/1000;
    if (header.alg !== 'RS256' || !['accounts.google.com','https://accounts.google.com'].includes(claims.iss)
        || claims.aud !== clientId) return null;
    if (!Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60)
      return fail('La identificación venció. Recargá esta página para volver a entrar.');
    if (nonce !== undefined && claims.nonce !== nonce)
      return fail('Se abrió otra sesión de ingreso. Recargá esta pestaña y elegí tu cuenta de nuevo.');
    if (!keys || expiry <= now) {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
      if (!response.ok) return null;
      keys = (await response.json()).keys;
      expiry = now + 300;
    }
    const jwk = keys.find(key => key.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(signature),new TextEncoder().encode(head+'.'+body));
    if (!valid) return null;
    if (claims.email_verified !== true || !allowed.has(claims.email?.toLowerCase()))
      return fail('Elegí una cuenta de Google autorizada para POS 365.');
    if (claims.email.toLowerCase() !== personalEmail && (typeof claims.hd !== 'string' || !claims.hd.trim()))
      return fail('Google no identificó esta cuenta como cuenta administrada de la empresa.');
    return claims;
  } catch { return null; }
}
const masterEmail='carlosxu@dcasa-cr.com';
const passwordCookie='__Host-cedi_password';
const authHex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const randomAuth=()=>authHex(crypto.getRandomValues(new Uint8Array(32)));
const authDigest=async text=>authHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return authHex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',salt:new TextEncoder().encode(salt),iterations:100000},key,256));
}
async function authTables(db){
 await db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS pos_credentials (user_id TEXT PRIMARY KEY, email TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, version TEXT NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS pos_sessions (token TEXT PRIMARY KEY,user_id TEXT NOT NULL,version TEXT NOT NULL,expires INTEGER NOT NULL,issued INTEGER NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS pos_login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)')
 ]);
}
// Authentication must never inflate the application/XML snapshot.
async function authDirectory(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS pos_auth_directory (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)').run();
 const row=await db.prepare('SELECT payload FROM pos_auth_directory WHERE id=1').first();
 return row?JSON.parse(row.payload):[];
}
function authDirectoryPayload(users){
 if(!Array.isArray(users)||users.length>1000)throw Error('Directorio de acceso inválido.');
 const ids=new Set(),emails=new Set(),names=new Set();
 const clean=users.map(u=>{
  if(!u||typeof u.id!=='string'||!u.id||u.id.length>128||ids.has(u.id)||typeof u.email!=='string'||u.email.length>254||!/^\S+@\S+\.\S+$/.test(u.email))throw Error('Usuario de acceso inválido.');
  ids.add(u.id);
  const email=u.email.trim().toLowerCase(),username=String(u.username||'').trim().toLowerCase();
  if(username&&!/^[a-z0-9._-]{3,64}$/.test(username))throw Error('Nombre de acceso inválido.');
  if(/^caja(0[1-9]|[1-9][0-9])$/.test(username)||email.endsWith('@pos365.invalid'))throw Error('Los accesos CAJA01 a CAJA99 están reservados para la pestaña Cajeros.');
  if(!u.deleted){if(emails.has(email)||(username&&names.has(username)))throw Error('Usuario de acceso repetido.');emails.add(email);if(username)names.add(username);}
  return {id:u.id,email,username,firstName:String(u.firstName||'').slice(0,100),lastName:String(u.lastName||'').slice(0,100),deleted:!!u.deleted,suspended:!!u.suspended};
 });
 const payload=JSON.stringify(clean);
 if(new TextEncoder().encode(payload).length>60000)throw Error('Directorio de acceso demasiado grande.');
 return payload;
}
async function cashierTable(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS pos_cashiers (box TEXT PRIMARY KEY,name TEXT NOT NULL,active INTEGER NOT NULL,version TEXT NOT NULL)').run();
 await db.prepare("WITH RECURSIVE boxes(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM boxes WHERE n<15) INSERT OR IGNORE INTO pos_cashiers(box,name,active,version) SELECT printf('%02d',n),'',0,'initial' FROM boxes").run();
}
async function accessDirectory(db){
 const users=await authDirectory(db);await cashierTable(db);
 const cashiers=await db.prepare('SELECT box,name,active FROM pos_cashiers').all();
 return [...users,...cashiers.results.map(c=>({id:'cashier-'+c.box,email:'caja'+c.box+'@pos365.invalid',username:'caja'+c.box,firstName:c.name,lastName:'',suspended:!c.active,kind:'cashier',box:c.box}))];
}
async function manageCashiers(request,env,email){
 if(email!==masterEmail)return json({error:'Solo la cuenta máster puede administrar cajeros.'},403);
 const db=env.DB;await cashierTable(db);await authTables(db);
 if(request.method==='GET'){
  const rows=await db.prepare("SELECT b.box,b.name,b.active,b.version,CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END AS hasPassword FROM pos_cashiers b LEFT JOIN pos_credentials c ON c.user_id='cashier-'||b.box ORDER BY b.box").all();
  return json({cashiers:rows.results.map(r=>({...r,active:!!r.active,hasPassword:!!r.hasPassword}))});
 }
 if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Content-Type')!=='application/json')return json({error:'Solicitud no permitida.'},403);
 const body=await request.json().catch(()=>null);if(!body)return json({error:'Datos incompletos.'},400);
 if(body.action==='add'){
  const added=await db.prepare("INSERT INTO pos_cashiers(box,name,active,version) SELECT printf('%02d',MAX(CAST(box AS INTEGER))+1),'',0,? FROM pos_cashiers HAVING MAX(CAST(box AS INTEGER))<99 RETURNING box").bind(randomAuth()).first();
  return added?json({ok:true,box:added.box}):json({error:'Se alcanzó el límite de CAJA99.'},400);
 }
 if(body.action!=='save'||! /^(0[1-9]|[1-9][0-9])$/.test(body.box)||typeof body.name!=='string'||body.name.trim().length>200||typeof body.active!=='boolean'||typeof body.version!=='string'||typeof body.password!=='string')return json({error:'Revise los datos del cajero.'},400);
 const row=await db.prepare('SELECT * FROM pos_cashiers WHERE box=?').bind(body.box).first();
 if(!row||row.version!==body.version)return json({error:'La caja cambió en otra sesión. Recargue la lista.'},409);
 const userId='cashier-'+body.box,identity='caja'+body.box+'@pos365.invalid',name=body.name.trim();
 const credential=await db.prepare('SELECT user_id FROM pos_credentials WHERE user_id=?').bind(userId).first();
 if(body.password&&(body.password.length<12||body.password.length>128))return json({error:'Use una clave de 12 a 128 caracteres.'},400);
 if(body.active&&(!name||(!credential&&!body.password)))return json({error:'Para activar la caja complete nombre y clave.'},400);
 // Reserve CAJAxx for the dedicated cashier account; do not create ambiguous logins.
 const users=await authDirectory(db);if(users.some(u=>!u.deleted&&(u.username==='caja'+body.box||u.email===identity)))return json({error:'Ese acceso ya está asignado a un usuario. Cambie su nombre de acceso antes de activar esta caja.'},409);
 const version=randomAuth(),writes=[db.prepare('UPDATE pos_cashiers SET name=?,active=?,version=? WHERE box=? AND version=?').bind(name,body.active?1:0,version,body.box,body.version)];
 if(body.password){const salt=randomAuth(),hash=await passwordHash(body.password,salt);writes.push(db.prepare('INSERT INTO pos_credentials(user_id,email,salt,hash,version) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM pos_cashiers WHERE box=? AND version=?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,salt=excluded.salt,hash=excluded.hash,version=excluded.version').bind(userId,identity,salt,hash,randomAuth(),body.box,version));}
 if(body.password||!body.active)writes.push(db.prepare('DELETE FROM pos_sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM pos_cashiers WHERE box=? AND version=?)').bind(userId,body.box,version));
 const result=await db.batch(writes);if(!(result[0].meta?.changes??result[0].changes))return json({error:'La caja cambió en otra sesión. Recargue la lista.'},409);
 return json({ok:true,box:body.box,version});
}

function credentialUser(users,id){return users.find(u=>u.id===id&&!u.deleted&&!u.suspended);}
async function passwordSession(request,env){
 const token=cookie(request,passwordCookie);
 if(!token||!/^[0-9a-f]{64}$/.test(token))return null;
 await authTables(env.DB);
 const row=await env.DB.prepare('SELECT s.*,c.email AS credential_email FROM pos_sessions s JOIN pos_credentials c ON c.user_id=s.user_id AND c.version=s.version WHERE token=? AND expires>?').bind(await authDigest(token),Date.now()).first();
 if(!row)return null;
 const user=credentialUser(await accessDirectory(env.DB),row.user_id);
 if(!user||user.email.toLowerCase()!==row.credential_email)return null;
 return {email:user.email,name:[user.firstName,user.lastName].filter(Boolean).join(' '),kind:user.kind||'user',box:user.box||null,userId:user.id,iat:row.issued/1000,exp:row.expires/1000};
}
async function saveCredential(request,env,email){
 if(email!==masterEmail)return json({error:'Solo la cuenta máster puede cambiar claves.'},403);
 if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Content-Type')!=='application/json')return json({error:'Solicitud no permitida.'},403);
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.userId!=='string'||typeof body.password!=='string'||body.password.length<12||body.password.length>128)return json({error:'Use una clave de 12 a 128 caracteres.'},400);
 const user=credentialUser(await authDirectory(env.DB),body.userId);
 if(!user)return json({error:'Primero guarde un usuario activo.'},400);
 await authTables(env.DB);
 const salt=randomAuth(),hash=await passwordHash(body.password,salt);
 await env.DB.batch([
  env.DB.prepare('INSERT INTO pos_credentials(user_id,email,salt,hash,version) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,salt=excluded.salt,hash=excluded.hash,version=excluded.version').bind(user.id,user.email.toLowerCase(),salt,hash,randomAuth()),
  env.DB.prepare('DELETE FROM pos_sessions WHERE user_id=?').bind(user.id)
 ]);
 return json({ok:true});
}
async function passwordLogin(request,env){
 if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Content-Type')!=='application/json')return json({error:'Solicitud no permitida.'},403);
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.identifier!=='string'||typeof body.password!=='string'||body.identifier.length>254||body.password.length>128)return json({error:'Revise el usuario y la clave.'},400);
 await authTables(env.DB);
 const identifier=body.identifier.trim().toLowerCase(),now=Date.now();
 const bucket=await authDigest((request.headers.get('CF-Connecting-IP')||'local')+'|'+Math.floor(now/900000));
 const attempts=await env.DB.prepare('INSERT INTO pos_login_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+900000).first();
 if(attempts.count>30)return json({error:'Demasiados intentos. Espere 15 minutos.'},429);
 const users=await accessDirectory(env.DB);
 const matches=users.filter(u=>!u.deleted&&!u.suspended&&[u.email,u.username].some(v=>typeof v==='string'&&v.toLowerCase()===identifier));
 const user=matches.length===1?matches[0]:null;
 const stored=user?await env.DB.prepare('SELECT * FROM pos_credentials WHERE user_id=?').bind(user.id).first():null;
 const hash=await passwordHash(body.password,stored?.salt||'invalid-login-salt');
 let diff=0;const expected=stored?.hash||'0'.repeat(64);
 for(let i=0;i<64;i++)diff|=hash.charCodeAt(i)^expected.charCodeAt(i);
 if(!stored||stored.email!==user.email.toLowerCase()||diff||await accountBlock(env.DB,user.email.toLowerCase()))return json({error:'Usuario o clave incorrectos, o cuenta bloqueada.'},401);
 const token=randomAuth(),expires=now+8*3600000;
 await env.DB.batch([
  env.DB.prepare('INSERT INTO pos_sessions(token,user_id,version,expires,issued) VALUES(?,?,?,?,?)').bind(await authDigest(token),user.id,stored.version,expires,now),
  env.DB.prepare('DELETE FROM pos_sessions WHERE expires<?').bind(now),
  env.DB.prepare('DELETE FROM pos_login_attempts WHERE expires<?').bind(now)
 ]);
 const response=json({ok:true});
 response.headers.append('Set-Cookie',setCookie(passwordCookie,token,8*3600));
 response.headers.append('Set-Cookie',setCookie(sessionCookie,'',0));
 return response;
}

async function voucherTable(db){await db.prepare('CREATE TABLE IF NOT EXISTS pos_vouchers (code TEXT PRIMARY KEY, return_id TEXT NOT NULL UNIQUE, cents INTEGER NOT NULL, issued INTEGER NOT NULL, expires INTEGER NOT NULL, redeemed_sale TEXT, redeemed_at INTEGER)').run();}
function validVoucherOperation(op){return op&&['issue','redeem'].includes(op.kind)&&/^NC[0-9A-F]{24}$/.test(op.code)&&typeof op.recordId==='string'&&/^[0-9a-f-]{36}$/.test(op.recordId)&&Number.isSafeInteger(op.cents)&&op.cents>0;}
async function readVoucher(db,code){await voucherTable(db);return db.prepare('SELECT * FROM pos_vouchers WHERE code=?').bind(code).first();}
function voucherInfo(row){return row?{code:row.code,cents:row.cents,issued:row.issued,expires:row.expires,used:!!row.redeemed_sale}:null;}

async function lotTables(db){
 await db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS internal_invoices (number INTEGER PRIMARY KEY, draft TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'),
  db.prepare('CREATE TABLE IF NOT EXISTS lot_movements (id TEXT PRIMARY KEY, payload TEXT NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
 ]);
}
function validLotText(value,max=100){return typeof value==='string'&&value.trim().length>0&&value.length<=max;}
function validateInvoiceLots(bill){
 for(const line of bill.lines){
  if(line.lot!==undefined&&(typeof line.lot!=='string'||line.lot.length>100))return false;
  if(line.lot&&(!validLotText(line.lot)||!validLotText(line.productKey,200)||!validLotText(bill.header.bodega)||!(line.units>0)))return false;
 }
 return true;
}
async function lotRecords(db){
 await lotTables(db);
 const sales=await db.prepare("SELECT json_extract(j.value,'$.productKey') AS productKey, json_extract(i.payload,'$.header.bodega') AS warehouse, json_extract(j.value,'$.lot') AS lot, MAX(json_extract(j.value,'$.code')) AS code, MAX(json_extract(j.value,'$.name')) AS name, SUM(json_extract(j.value,'$.units')) AS quantity FROM internal_invoices i, json_each(i.payload,'$.lines') j WHERE COALESCE(json_extract(j.value,'$.lot'),'')<>'' GROUP BY productKey,warehouse,lot").all();
 const adjustments=await db.prepare("SELECT json_extract(j.value,'$.productKey') AS productKey,json_extract(j.value,'$.warehouse') AS warehouse,json_extract(j.value,'$.lot') AS lot,MAX(json_extract(j.value,'$.code')) AS code,MAX(json_extract(j.value,'$.name')) AS name,SUM(json_extract(j.value,'$.delta')) AS quantity FROM lot_movements m,json_each(m.payload,'$.entries') j GROUP BY productKey,warehouse,lot").all();
 const history=await db.prepare('SELECT id,payload,author,created_at FROM lot_movements ORDER BY created_at DESC,rowid DESC LIMIT 200').all();
 return {sales:sales.results,adjustments:adjustments.results,history:history.results.map(row=>({...JSON.parse(row.payload),author:row.author,date:row.created_at}))};
}
function lotMovement(body){
 if(!body||!validLotText(body.id,100)||!['transfer','adjust','copy'].includes(body.kind)||!validLotText(body.productKey,200)||!validLotText(body.code,200)||!validLotText(body.name,1000)||!validLotText(body.warehouse)||!validLotText(body.source)||!validLotText(body.reason,500)||!Number.isFinite(body.quantity)||body.quantity===0||Math.abs(body.quantity)>1e12)throw Error('Revise producto, lote, cantidad y motivo.');
 if(body.kind!=='adjust'&&(!validLotText(body.target)||body.target.trim()===body.source.trim()||body.quantity<=0))throw Error('Elija otro lote de destino y una cantidad positiva.');
 const common={productKey:body.productKey,code:body.code,name:body.name,warehouse:body.warehouse};
 const entries=body.kind==='adjust'?[{...common,lot:body.source.trim(),delta:body.quantity}]:body.kind==='transfer'?[{...common,lot:body.source.trim(),delta:-body.quantity},{...common,lot:body.target.trim(),delta:body.quantity}]:[{...common,lot:body.target.trim(),delta:body.quantity}];
 return {id:body.id,kind:body.kind,source:body.source.trim(),target:body.kind==='adjust'?'':body.target.trim(),quantity:body.quantity,reason:body.reason.trim(),entries};
}
async function manageLots(request,env,email){
 if(request.method==='GET')return json(await lotRecords(env.DB));
 if(request.method!=='POST')return json({error:'Método no permitido.'},405);
 if(email!==masterEmail)return json({error:'Solo la cuenta máster puede ajustar lotes.'},403);
 if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Content-Type')!=='application/json')return json({error:'Solicitud no permitida.'},403);
 let move;try{move=lotMovement(await request.json());}catch(error){return json({error:error.message},400);}
 await lotTables(env.DB);const payload=JSON.stringify(move);
 await env.DB.prepare('INSERT INTO lot_movements(id,payload,author) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(move.id,payload,email).run();
 const saved=await env.DB.prepare('SELECT payload,author FROM lot_movements WHERE id=?').bind(move.id).first();
 if(saved?.payload!==payload||saved.author!==email)return json({error:'El movimiento ya existe con otros datos. Recargue el historial.'},409);
 return json({ok:true,id:move.id});
}

async function activeCashierChoices(db){
 const users=await accessDirectory(db);
 return users.filter(user=>!user.deleted&&!user.suspended).map(user=>({
  value:user.kind==='cashier'?user.username.toUpperCase():(user.username||user.email),
  label:user.kind==='cashier'?user.username.toUpperCase():([user.firstName,user.lastName].filter(Boolean).join(' ')||user.username||user.email)
 })).sort((a,b)=>a.value.localeCompare(b.value,'es',{numeric:true}));
}
function login() {
  const nonce = crypto.randomUUID();
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="apple-mobile-web-app-title" content="POS 365">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/pos365-inicio-192.png">
<link rel="manifest" href="/pos365.webmanifest">
<title>Ingresar a POS 365</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:32px;background:#edf2ed;color:#142e28;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{width:min(100%,990px);display:grid;grid-template-columns:1.1fr 1fr;border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 24px 80px #17362a20}
.brand{position:relative;isolation:isolate;overflow:hidden;min-height:520px;padding:48px;display:flex;flex-direction:column;justify-content:space-between;color:#fff;background:linear-gradient(140deg,#123930,#075845)}
.brand:before{content:"";position:absolute;inset:-5% -60% -40% 20%;z-index:-1;background:repeating-radial-gradient(ellipse at 90% 42%,transparent 0 26px,#c9edb326 27px 28px,transparent 29px 45px);transform:rotate(-20deg)}
.wordmark{font-size:26px;font-weight:800;letter-spacing:-1.8px;display:flex;align-items:center;gap:10px}.mark{width:25px;height:25px;display:inline-block;border:6px solid #c7ee88;border-right-color:transparent;border-radius:8px;transform:rotate(-12deg)}
.art{position:relative;align-self:center;width:160px;height:172px;margin:24px;transform:rotate(9deg);filter:drop-shadow(0 11px 9px #092c2770)}
.paper{height:100%;background:#edf7d5;padding:24px 20px;color:#275541;clip-path:polygon(0 0,100% 0,100% 100%,90% 95%,80% 100%,70% 95%,60% 100%,50% 95%,40% 100%,30% 95%,20% 100%,10% 95%,0 100%)}
.paper b{font-size:18px;letter-spacing:-1px}.lines{height:42px;margin:12px 0;border-block:2px dashed #88a68a;background:repeating-linear-gradient(0deg,transparent 0 7px,#88a68a 7px 9px,transparent 9px 14px);background-size:65% 100%;background-repeat:no-repeat}.bars{height:24px;background:repeating-linear-gradient(90deg,#275541 0 2px,transparent 2px 5px,#275541 5px 9px,transparent 9px 11px)}
.brand h1{margin:0;font-size:clamp(34px,5vw,56px);line-height:1;letter-spacing:-.055em}.brand p{margin:12px 0 0;color:#cfdfd5;line-height:1.5}
.entry{padding:clamp(28px,5vw,64px);align-self:center;min-width:0}.entry h2{margin:0;font-size:clamp(32px,4vw,44px);letter-spacing:-.05em}.entry p{line-height:1.55;color:#51665f}.entry form{display:grid;gap:16px;margin-top:24px}.entry label{display:grid;gap:6px}.entry input,.entry button{font:inherit;padding:12px;width:100%;border:1px solid #afc3b7;border-radius:6px}.entry button{background:#195e45;color:white;cursor:pointer}.entry #google{min-height:44px;margin-top:32px}.entry #status{color:#8a331d;font-size:14px}.entry #status:empty{display:none}
.login-picker{position:relative;min-width:0}.login-picker>label{margin-bottom:6px}.login-picker-field{position:relative}.entry .login-picker-field input{padding-right:54px}.entry #login-choices-toggle{position:absolute;right:1px;top:1px;bottom:1px;width:46px;padding:0;border:0;border-left:1px solid #afc3b7;border-radius:0 5px 5px 0;font-size:20px}.login-choices{position:absolute;top:100%;left:0;right:0;z-index:10;max-height:230px;overflow:auto;background:#fff;border:1px solid #afc3b7;border-radius:6px;box-shadow:0 8px 22px #17362a30;padding:4px}.login-choices[hidden]{display:none}.entry .login-choices button{display:block;background:#fff;color:#142e28;border:0;text-align:left;padding:10px;font-size:14px;overflow-wrap:anywhere}.entry .login-choices button:hover,.entry .login-choices button:focus{background:#e4efe8;outline:2px solid #195e45;outline-offset:-2px}.entry .login-choices p{margin:8px;font-size:14px}
@media(max-width:680px){body{padding:16px}main{grid-template-columns:1fr}.brand{min-height:202px;padding:26px}.art{position:absolute;right:4px;top:8px;transform:rotate(9deg) scale(.66);transform-origin:top right;margin:12px}.brand h1{font-size:32px}.brand p{font-size:14px}.entry{padding:32px 26px 40px}}
</style>
<main><section class="brand"><div class="wordmark"><img src="/assets/pos-365-logo.png" alt="POS 365 · Sistema de facturación" style="width:min(100%,320px);height:auto;background:#edf2ed;padding:12px;border-radius:12px"></div>
<div class="art" aria-hidden="true"><div class="paper"><b>POS 365</b><div class="lines"></div><div class="bars"></div></div></div>
<div><h1>POS 365</h1><p>Ventas, compras e inventario</p></div></section>
<section class="entry" aria-labelledby="welcome"><h2 id="welcome">Bienvenido</h2><form id="password-login"><div class="login-picker" id="login-picker"><label for="login-identifier">Usuario o correo</label><div class="login-picker-field"><input id="login-identifier" name="identifier" autocomplete="username" placeholder="Busque un usuario o caja" required maxlength="254" aria-controls="login-choices"><button type="button" id="login-choices-toggle" aria-label="Mostrar usuarios y cajas activas" aria-expanded="false" aria-controls="login-choices">▼</button></div><div id="login-choices" class="login-choices" hidden></div></div><label>Clave<input name="password" type="password" autocomplete="current-password" required maxlength="128"></label><button type="submit">Ingresar</button></form><p>También puede ingresar con Google</p><div id="google"></div><p id="status" role="status"></p><noscript>Activá JavaScript para iniciar sesión con Google.</noscript></section></main>
<script nonce="${nonce}">const picker=document.getElementById('login-picker'),identifier=document.getElementById('login-identifier'),choicesList=document.getElementById('login-choices'),choicesToggle=document.getElementById('login-choices-toggle');let loginChoices=[],choicesLoading=false,choicesError=false;
function closeLoginChoices(){choicesList.hidden=true;choicesToggle.setAttribute('aria-expanded','false');}
function renderLoginChoices(query=''){choicesList.replaceChildren();const term=query.trim().toLocaleLowerCase('es'),matches=loginChoices.filter(item=>(item.value+' '+item.label).toLocaleLowerCase('es').includes(term));for(const item of matches){const option=document.createElement('button');option.type='button';option.textContent=item.label===item.value?item.value:item.label+' · '+item.value;option.onclick=()=>{identifier.value=item.value;closeLoginChoices();document.querySelector('[name="password"]').focus();};choicesList.append(option);}if(!matches.length){const message=document.createElement('p');message.setAttribute('role','status');message.textContent=choicesLoading?'Cargando usuarios y cajas…':choicesError?'No se pudo cargar la lista. Puede escribir su usuario.':'No hay usuarios o cajas que coincidan.';choicesList.append(message);}}
async function openLoginChoices(showAll=false){choicesList.hidden=false;choicesToggle.setAttribute('aria-expanded','true');choicesLoading=true;choicesError=false;renderLoginChoices(showAll?'':identifier.value);try{const response=await fetch('/auth/cashier-choices',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();loginChoices=data.choices||[];}catch{loginChoices=[];choicesError=true;}finally{choicesLoading=false;if(!choicesList.hidden)renderLoginChoices(showAll?'':identifier.value);}}
choicesToggle.onclick=()=>{if(choicesList.hidden)openLoginChoices(true);else closeLoginChoices();};identifier.addEventListener('input',()=>{if(choicesList.hidden)openLoginChoices();else renderLoginChoices(identifier.value);});identifier.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();if(choicesList.hidden)openLoginChoices(true);else choicesList.querySelector('button')?.focus();}if(event.key==='Escape')closeLoginChoices();});choicesList.addEventListener('keydown',event=>{if(event.key==='Escape'){closeLoginChoices();identifier.focus();}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const items=[...choicesList.querySelectorAll('button')],index=items.indexOf(document.activeElement);items[Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowDown'?1:-1)))]?.focus();}});document.addEventListener('click',event=>{if(!picker.contains(event.target))closeLoginChoices();});picker.addEventListener('focusout',event=>{if(!picker.contains(event.relatedTarget))closeLoginChoices();});
document.getElementById('password-login').onsubmit=async e=>{e.preventDefault();const f=e.target,b=f.querySelector('button[type=submit]'),status=document.getElementById('status');b.disabled=true;status.textContent='Ingresando…';try{const r=await fetch('/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:f.elements.identifier.value,password:f.elements.password.value})});const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo ingresar.');location.replace('/');}catch(error){status.textContent=error.message;}finally{b.disabled=false;f.elements.password.value='';}};function iniciar(){google.accounts.id.initialize({client_id:'${clientId}',nonce:'${nonce}',callback:async function(r){const status=document.getElementById('status');try{const result=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:r.credential,challenge:'${nonce}'})});if(result.ok){location.replace('/');return}const error=await result.json();status.textContent=error.error || 'Falló la verificación de Google. Volvé a intentarlo.'}catch{status.textContent='Falló la conexión. Intentá otra vez.'}}});google.accounts.id.renderButton(document.getElementById('google'),{type:'standard',locale:'es',size:'large',width:Math.min(360,document.getElementById('google').clientWidth)})}</script>
<script src="https://accounts.google.com/gsi/client" async onload="iniciar()"></script></html>`,{headers:{'Content-Type':'text/html;charset=UTF-8','Cache-Control':'no-store','Set-Cookie':setCookie(nonceCookie+'_'+nonce,nonce,600),'Cross-Origin-Opener-Policy':'same-origin-allow-popups','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY'}});
}
function saveError(error){
      const kind=String(error.message||'').toLowerCase();
      const reason=/too large|too big|limit|quota/.test(kind)?'La base alcanzó un límite al guardar.':/busy|locked/.test(kind)?'La base estaba ocupada.':'El servicio de base de datos no pudo completar la escritura.';
      return json({error:reason+' Verificá el último registro guardado antes de reintentar.'},503);
}
// Derived read model. The primary snapshot remains authoritative. A generation
// becomes visible only after every catalog part and price row has been written.
const priceDayFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Costa_Rica',year:'numeric',month:'2-digit',day:'2-digit'});
async function prepareLegacyCatalog(primary,cache) {
  await cache.batch([
    cache.prepare('CREATE TABLE IF NOT EXISTS lookup_head(id INTEGER PRIMARY KEY, revision TEXT, generation TEXT, parts INTEGER)'),
    cache.prepare('CREATE TABLE IF NOT EXISTS lookup_catalog(generation TEXT, part INTEGER, payload TEXT, PRIMARY KEY(generation,part))'),
    cache.prepare('CREATE TABLE IF NOT EXISTS lookup_sold_price(generation TEXT,day TEXT,article TEXT,supplier TEXT,price REAL,PRIMARY KEY(generation,day,article,supplier,price))'),
    cache.prepare('CREATE TABLE IF NOT EXISTS lookup_price(generation TEXT, day TEXT, article TEXT, time REAL, price REAL, PRIMARY KEY(generation,day,article))')
  ]);
  const current=await primary.prepare('SELECT revision,parts FROM cedi_head WHERE id=1').first();
  if(!current)throw Error('Falta la base principal');
  const previous=await cache.prepare('SELECT revision,generation,parts FROM lookup_head WHERE id=1').first();
  const indexRevision='confirmed-history-v2:'+current.revision;
  if(previous?.revision===indexRevision)return previous;
  let offset=0;
  const stream=new ReadableStream({async pull(controller){
    if(offset>=current.parts){controller.close();return;}
    const {results}=await primary.prepare('SELECT part,payload FROM cedi_parts WHERE revision=? AND part>=? ORDER BY part LIMIT 8').bind(current.revision,offset).all();
    if(!results.length)throw Error('Cambió el catálogo');
    for(const row of results){
      if(row.part!==offset++)throw Error('Catálogo incompleto');
      controller.enqueue(Uint8Array.from(atob(row.payload),c=>c.charCodeAt(0)));
    }
  }});
  const snapshot=await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).json();
  const generation=crypto.randomUUID();
  const sales=snapshot.sales||[];
  for(const field of ['sales','purchases','purchaseOrders','purchaseDraft','legacyPurchaseDraft','cashOutContacts','cashOutEntries','cxpState','xmlInboxState'])delete snapshot[field];
  const compressed=await new Response(new Blob([JSON.stringify(snapshot)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const writes=[];
  async function flush(){
    if(writes.length)await cache.batch(writes.splice(0));
  }
  async function clean(id){
    await cache.batch(['lookup_catalog','lookup_price','lookup_sold_price'].map(table=>cache.prepare('DELETE FROM '+table+' WHERE generation=? AND generation NOT IN (SELECT generation FROM lookup_head)').bind(id)));
  }
  try{
    let parts=0;
    for(let start=0;start<compressed.byteLength;start+=48000){
      const block=new Uint8Array(compressed,start,Math.min(48000,compressed.byteLength-start));
      writes.push(cache.prepare('INSERT INTO lookup_catalog VALUES(?,?,?)').bind(generation,parts++,btoa(String.fromCharCode(...block))));
      if(writes.length===8)await flush();
    }
    const latest=new Map(),sold=new Set();
    for(const sale of sales){
      const documentTime=Date.parse(sale.date);
      const time=Date.parse(sale.recordedAt||sale.date);
      if(!Number.isFinite(documentTime)||!Number.isFinite(time)||['annulled','cancelled','void'].includes(sale.status))continue;
      const day=/^\d{4}-\d{2}-\d{2}$/.test(sale.date)?sale.date:priceDayFormat.format(documentTime);
      // The previous POS stored the selected date in a Costa Rica timestamp
      // alongside recordedAt. Older clock-only receipts cannot establish that date.
      const confirmedDay=sale.invoiceDate!==undefined?sale.invoiceDate===day:
        Number.isFinite(Date.parse(sale.recordedAt))&&sale.date.endsWith('-06:00');
      for(const line of sale.lines||[]){
        const article=line.barcode||line.code;
        if(!article||!Number.isFinite(line.price)||line.price<0)continue;
        if(confirmedDay&&Number.isSafeInteger(line.price)&&line.price%5===0)sold.add(JSON.stringify([day,article,line.supplier||'',line.price]));
        const key=JSON.stringify([day,article]),old=latest.get(key);
        if(!old||old[2]<=time)latest.set(key,[day,article,time,line.price]);
      }
    }
    async function writePrices(table,items,encode){
      let rows=[],size=0;
      function enqueue(){
        writes.push(cache.prepare('INSERT INTO '+table+' SELECT ?,value->>0,value->>1,value->>2,value->>3 FROM json_each(?)').bind(generation,'['+rows.join(',')+']'));
        rows=[];size=0;
      }
      for(const item of items){
        const encoded=encode(item);
        rows.push(encoded);size+=encoded.length;
        if(size>=16000)enqueue();
        if(writes.length>=8)await flush();
      }
      if(rows.length)enqueue();
    }
    await writePrices('lookup_price',latest.values(),JSON.stringify);
    await writePrices('lookup_sold_price',sold,value=>value);
    await flush();
    const head=await primary.prepare('SELECT revision FROM cedi_head WHERE id=1').first();
    if(head?.revision!==current.revision)throw Error('Cambió el catálogo');
    const changed=await cache.prepare('INSERT INTO lookup_head VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,generation=excluded.generation,parts=excluded.parts WHERE lookup_head.generation IS ?').bind(indexRevision,generation,parts,previous?.generation??null).run();
    if(!changed.meta.changes){
      const winner=await cache.prepare('SELECT revision,generation,parts FROM lookup_head WHERE id=1').first();
      if(winner?.revision!==indexRevision)throw Error('Cambió el catálogo');
      await clean(generation);return winner;
    }
    if(previous)await clean(previous.generation);
    return {revision:indexRevision,generation,parts};
  }catch(error){await clean(generation);throw error;}
}

async function accountBlock(db,email){
  try{return await db.prepare('SELECT blocked_at FROM cedi_blocked_accounts WHERE email=?').bind(email).first();}
  catch(error){
    if(/no such table: (?:main\.)?cedi_blocked_accounts\b/i.test(String(error.message)))return null;
    throw error;
  }
}
function mayBlock(env,email){
  return email===masterEmail||(env.USER_ADMIN_EMAILS||'').split(',').some(value=>value.trim().toLowerCase()===email);
}
export default { async fetch(request, env) {
  const url=new URL(request.url);
  if(['GET','HEAD'].includes(request.method)&&['/apple-touch-icon.png','/assets/pos-365-logo.png','/pos365.webmanifest','/assets/pos365-inicio-180.png','/assets/pos365-inicio-192.png','/assets/pos365-inicio-512.png'].includes(url.pathname))return env.ASSETS.fetch(request);
  if(['GET','HEAD'].includes(request.method)&&/^\/apple-touch-icon(?:-\d+x\d+)?(?:-precomposed)?\.png$/.test(url.pathname)){
    return env.ASSETS.fetch(new Request(new URL('/apple-touch-icon.png',url),request));
  }
  if(url.pathname==='/favicon.ico')return Response.redirect(new URL('/assets/pos365-inicio-192.png',url),302);
  if(url.pathname==='/auth/cashier-choices'&&request.method==='GET'){
    try{const response=json({choices:await activeCashierChoices(env.DB)});response.headers.set('Cache-Control','no-store');return response;}catch{return json({error:'No se pudieron cargar los usuarios y cajas.'},503);}
  }
  if(url.pathname==='/login')return login();
  if(url.pathname==='/auth/password'){try{return await passwordLogin(request,env);}catch{return json({error:'No se pudo comprobar el acceso. Intente de nuevo.'},503);}}
  if(url.pathname==='/auth/login' && request.method==='POST'){
    const {token,challenge}=await request.json();
    if(typeof challenge!=='string'||!/^[0-9a-f-]{36}$/.test(challenge))return json({error:'Recargá POS 365 para actualizar la pantalla de ingreso.'},403);
    const nonce=cookie(request,nonceCookie+'_'+challenge);
    if(!nonce)return json({error:'La sesión de ingreso venció o el navegador bloqueó su cookie. Abrí la página directamente en Firefox y volvé a entrar.'},403);
    if(request.headers.get('Origin')!==url.origin || request.headers.get('Content-Type')!=='application/json')return json({},403);
    const failure={};
    const claims=await verify(token,nonce,failure);
    if(!claims)return json({error:failure.message || 'POS 365 no pudo verificar la firma o el origen de la identificación de Google.'},403);
    if(await accountBlock(env.DB,claims.email.toLowerCase()))return json({error:'Su usuario está bloqueado.'},403);
    const response=json({ok:true});
    response.headers.append('Set-Cookie',setCookie(sessionCookie,token,Math.floor(claims.exp-Date.now()/1000)));
    response.headers.append('Set-Cookie',setCookie(passwordCookie,'',0));
    response.headers.append('Set-Cookie',setCookie(nonceCookie+'_'+challenge,'',0));
    return response;
  }
  if(url.pathname==='/auth/logout' && request.method==='POST' && request.headers.get('Origin')===url.origin){
    const token=cookie(request,passwordCookie);
    if(token){await authTables(env.DB);await env.DB.prepare('DELETE FROM pos_sessions WHERE token=?').bind(await authDigest(token)).run();}
    const response=new Response(null,{status:303,headers:{Location:'/login','Cache-Control':'no-store'}});
    response.headers.append('Set-Cookie',setCookie(sessionCookie,'',0));
    response.headers.append('Set-Cookie',setCookie(passwordCookie,'',0));
    return response;
  }
  if(url.pathname==='/api/reloj-xml')return autoTick(request,env);
  const claims=await passwordSession(request,env)||await verify(cookie(request,sessionCookie));
  if(!claims)return url.pathname.startsWith('/api/') ? json({error:'Ingresá a POS 365 con Google.'},401) : new Response(null,{status:302,headers:{Location:'/login','Cache-Control':'no-store'}});
  const email=claims.email.toLowerCase();
  const block=await accountBlock(env.DB,email);
  const remaining=block?Math.max(0,block.blocked_at+600000-Date.now()):null;
  if(remaining===0||(block&&claims.iat*1000>block.blocked_at)){
    const denied=url.pathname.startsWith('/api/')?json({error:'Su usuario está bloqueado.'},403):new Response(null,{status:302,headers:{Location:'/login','Cache-Control':'no-store'}});
    denied.headers.append('Set-Cookie',setCookie(sessionCookie,'',0));return denied;
  }
  if(url.pathname==='/api/pos-voucher'&&request.method==='GET'){
    const code=(url.searchParams.get('code')||'').trim().toUpperCase();
    if(!/^NC[0-9A-F]{24}$/.test(code))return json({error:'Código de nota de crédito comercial inválido.'},400);
    const row=await readVoucher(env.DB,code);
    if(!row)return json({error:'La nota de crédito comercial no existe.'},404);
    if(row.redeemed_sale)return json({error:'La nota de crédito comercial ya fue utilizada.'},409);
    if(row.expires<=Date.now())return json({error:'La nota de crédito comercial venció.'},410);
    return json(voucherInfo(row));
  }
  if(url.pathname==='/api/lots'){try{return await manageLots(request,env,email);}catch{return json({error:'No se pudieron consultar o guardar los lotes. Intente de nuevo.'},503);}}
  if(url.pathname==='/api/internal-invoice'){
    if(request.method!=='POST')return json({error:'Se requiere POST.'},405);
    if(request.headers.get('Origin')!==url.origin||request.headers.get('Content-Type')!=='application/json')return json({error:'Solicitud no permitida.'},403);
    const bill=await request.json().catch(()=>null);
    if(!bill||!/^\d{8}$/.test(bill.number)||typeof bill.draft!=='string'||bill.draft.length!==36||!bill.header||!Array.isArray(bill.lines)||!bill.lines.length||!Array.isArray(bill.tenders))return json({error:'Revise el número y los artículos de la factura.'},400);
    if(!validateInvoiceLots(bill))return json({error:'Revise el lote, producto y bodega de la factura.'},400);
    let gross=0;
    for(const line of bill.lines){
      if(!line?.code||![line.units,line.price,line.rate].every(Number.isFinite)||line.price<0||line.rate<0)return json({error:'La factura contiene una línea inválida.'},400);
      const cents=Math.round((line.units*line.price+Number.EPSILON)*100);
      gross+=line.includesVAT?cents:cents+Math.round(cents*line.rate);
    }
    if(!Number.isSafeInteger(gross)||gross<=0||bill.gross!==gross||!Number.isSafeInteger(bill.discount)||bill.discount<0||bill.discount>gross||!bill.tenders.every(t=>Number.isSafeInteger(t?.cents)&&t.cents>=0)||![bill.rate,bill.dollars].every(n=>Number.isFinite(n)&&n>=0)||(bill.dollars>0&&!bill.rate))return json({error:'Revise el total y los medios de pago.'},400);
    const paid=bill.tenders.reduce((n,t)=>n+t.cents,Math.round(bill.rate*bill.dollars*100));
    if(!Number.isSafeInteger(paid)||paid<gross-bill.discount)return json({error:'El pago no cubre el total.'},400);
    const key=email+'/'+bill.draft,payload=JSON.stringify(bill);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS internal_invoices (number INTEGER PRIMARY KEY, draft TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
    const [,saved]=await env.DB.batch([
      env.DB.prepare('INSERT INTO internal_invoices(number,draft,payload) SELECT number,draft,? FROM internal_invoice_numbers WHERE number=? AND draft=? ON CONFLICT(number) DO NOTHING').bind(payload,Number(bill.number),key),
      env.DB.prepare('SELECT payload FROM internal_invoices WHERE number=? AND draft=?').bind(Number(bill.number),key)
    ]);
    if(saved.results[0]?.payload!==payload)return json({error:'Verifique el número reservado y los datos de la factura.'},409);
    return json({number:bill.number});
  }
  if(url.pathname==='/api/internal-invoice-number'){
    if(request.method!=='POST')return json({error:'Se requiere POST.'},405);
    if(request.headers.get('Origin')!==url.origin || request.headers.get('Content-Type')!=='application/json')return json({error:'Solicitud no permitida.'},403);
    const body=await request.json().catch(()=>null);
    if(typeof body?.draft!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(body.draft))return json({error:'Borrador inválido.'},400);
    const key=email+'/'+body.draft;
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS internal_invoice_numbers (number INTEGER PRIMARY KEY CHECK(number BETWEEN 1 AND 99999999), draft TEXT NOT NULL UNIQUE)').run();
    const [,read]=await env.DB.batch([
      env.DB.prepare('INSERT INTO internal_invoice_numbers(draft) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM internal_invoice_numbers WHERE draft=?)').bind(key,key),
      env.DB.prepare('SELECT number FROM internal_invoice_numbers WHERE draft=?').bind(key)
    ]);
    return json({number:String(read.results[0].number).padStart(8,'0')});
  }
  if(url.pathname==='/api/gmail-xml')return gmailRequest(request,env);
  if(url.pathname==='/api/user-credential'){try{return await saveCredential(request,env,email);}catch{return json({error:'No se confirmó el cambio de clave. Intente de nuevo.'},503);}}
  if(url.pathname==='/api/cashiers'){try{return await manageCashiers(request,env,email);}catch{return json({error:'No se confirmó el cambio de cajero. Recargue y verifique antes de repetirlo.'},503);}}
  if(url.pathname==='/api/session-access')return json({master:email===masterEmail,remaining,mayBlock:!block&&mayBlock(env,email),email,name:claims.name||'',kind:claims.kind||'user',box:claims.box||null,userId:claims.userId||null});
  if(!url.pathname.startsWith('/api/')){
    const asset=await env.ASSETS.fetch(request);
    const response=new Response(asset.body,asset);
    response.headers.set('Cache-Control','private, no-store');
    return response;
  }
  const legacy=url.pathname.startsWith('/api/legacy-purchases/');
  const db=legacy?env.LEGACY_PURCHASES_DB:env.DB;
  if(legacy){
    if(!db)return json({error:'Falta conectar la base independiente de Compras formato viejo.'},503);
    if(db===env.DB)return json({error:'La base de formato viejo debe ser independiente.'},503);
    url.pathname=url.pathname.replace('/api/legacy-purchases/','/api/');
    if(request.method==='GET'&&url.pathname==='/api/catalog'){
      try{return json(await prepareLegacyCatalog(env.DB,db));}
      catch{return json({error:'Volvé a cargar para actualizar el catálogo.'},503);}
    }
    if(request.method==='GET'&&url.pathname==='/api/catalog-parts'){
      const start=Number(url.searchParams.get('start'));
      if(!Number.isSafeInteger(start)||start<0)return json({},400);
      const {results}=await db.prepare('SELECT part,payload FROM lookup_catalog WHERE generation=? AND part>=? ORDER BY part LIMIT 8').bind(url.searchParams.get('generation'),start).all();
      return json(results);
    }
    if(request.method==='GET'&&url.pathname==='/api/price'){
      const keys=url.searchParams.getAll('key'),day=url.searchParams.get('day');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!keys.length||keys.length>3)return json({},400);
      if(url.searchParams.get('history')==='1'){
        const suppliers=url.searchParams.getAll('supplier');
        const {results}=await db.prepare("SELECT DISTINCT p.day,p.price FROM lookup_sold_price p WHERE generation=(SELECT generation FROM lookup_head WHERE id=1) AND day=? AND article IN (SELECT value FROM json_each(?)) AND (supplier='' OR supplier IN (SELECT value FROM json_each(?))) ORDER BY price").bind(day,JSON.stringify(keys),JSON.stringify(suppliers)).all();
        return json({day:results[0]?.day??day,prices:results.map(row=>row.price)});
      }
      const row=await db.prepare('SELECT (SELECT price FROM lookup_price WHERE generation=h.generation AND day=? AND article IN (SELECT value FROM json_each(?)) ORDER BY time DESC LIMIT 1) AS price FROM lookup_head h WHERE id=1').bind(day,JSON.stringify(keys)).first();
      return row?json(row):json({},503);
    }
    if(url.pathname==='/api/state'&&request.method==='GET'){
      await db.batch([
        db.prepare('CREATE TABLE IF NOT EXISTS cedi_head(id INTEGER PRIMARY KEY, revision TEXT NOT NULL, parts INTEGER NOT NULL, author TEXT NOT NULL)'),
        db.prepare('CREATE TABLE IF NOT EXISTS cedi_parts(revision TEXT NOT NULL, part INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(revision,part))'),
        db.prepare("INSERT OR IGNORE INTO cedi_head VALUES(1,'legacy-empty',0,'initial')")
      ]);
    }
  }
  if(url.pathname==='/api/state' && request.method==='GET'){
    const row=await db.prepare('SELECT revision,parts FROM cedi_head WHERE id=1').first();
    return row?json({...row,email}):json({error:'Falta importar la base.'},503);
  }
  if(url.pathname==='/api/parts' && request.method==='GET'){
    const start=Number(url.searchParams.get('start')),rev=url.searchParams.get('revision');
    if(!Number.isSafeInteger(start)||start<0||!rev)return json({},400);
    const {results}=await db.prepare('SELECT part,payload FROM cedi_parts WHERE revision=? AND part>=? ORDER BY part LIMIT 8').bind(rev,start).all();
    return json(results);
  }
  // Upload bounded batches first. Only the final transaction publishes a revision.
  if(url.pathname==='/api/save' && request.method==='POST'){
    if(request.headers.get('Origin')!==url.origin || request.headers.get('Content-Type')!=='application/json')return json({},403);
    const {base,id,count,changes,finish,blockEmail,authUsers,voucherOp}=await request.json();
    if(voucherOp!==undefined&&(legacy||block||finish!==true||!validVoucherOperation(voucherOp)))return json({error:'Operación de nota de crédito comercial inválida.'},400);
    if(authUsers!==undefined&&(email!==masterEmail||legacy||finish!==true||block))return json({error:"Solo la cuenta máster puede sincronizar accesos."},403);
    if(blockEmail!==undefined&&(legacy||finish!==true||block||!mayBlock(env,email)))return json({error:'Se requiere permiso para bloquear usuarios.'},403);
    if(blockEmail!==undefined&&(typeof blockEmail!=='string'||!/^\S+@\S+\.\S+$/.test(blockEmail)||blockEmail.length>254))return json({},400);
    if(typeof base!=='string'||typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id)||!Number.isInteger(count)||count<1||count>1600)return json({},400);
    try{
      const rev='save:'+id;
      const head=await db.prepare('SELECT revision,parts FROM cedi_head WHERE id=1').first();
      if(head?.revision===rev)return json({revision:rev,...(voucherOp?{voucher:voucherInfo(await readVoucher(db,voucherOp.code))}:{})});
      const conflict=()=>json({error:'La base cambió en otra sesión. Revisá la compra antes de repetirla.'},409);
      if(head?.revision!==base)return conflict();
      // Keep staging separate from live parts so retries cannot modify a published revision.
      await db.prepare('CREATE TABLE IF NOT EXISTS cedi_stage (id TEXT, part INTEGER, payload TEXT, created INTEGER, PRIMARY KEY(id,part))').run();
      const key=email+'|'+base+'|'+id;
      if(finish!==true){
        if(!Array.isArray(changes)||!changes.length||changes.length>4||changes.some(c=>!c||!Number.isInteger(c.part)||c.part<0||c.part>=count||typeof c.payload!=='string'||!c.payload.length||c.payload.length>64000||!/^[A-Za-z0-9+/]+=*$/.test(c.payload)))return json({},400);
        await db.batch(changes.map(({part,payload})=>db.prepare('INSERT OR REPLACE INTO cedi_stage (id,part,payload,created) VALUES (?,?,?,unixepoch())').bind(key,part,payload)));
        return json({staged:true});
      }
      if(!Number.isInteger(changes)||changes<0||changes>count)return json({},400);
      const accessWrites=[];let voucherGuard='',voucherBindings=[];
      if(voucherOp){
        await voucherTable(db);const now=Date.now(),old=await readVoucher(db,voucherOp.code);
        if(voucherOp.kind==='issue'){
          if(old||await db.prepare('SELECT code FROM pos_vouchers WHERE return_id=?').bind(voucherOp.recordId).first())return json({error:'Esta nota de crédito comercial ya existe.'},409);
          accessWrites.push(db.prepare('INSERT INTO pos_vouchers(code,return_id,cents,issued,expires) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cedi_head WHERE id=1 AND revision=?)').bind(voucherOp.code,voucherOp.recordId,voucherOp.cents,now,now+12*3600000,rev));
        }else{
          if(!old||old.redeemed_sale||old.expires<=now||old.cents!==voucherOp.cents)return json({error:'La nota de crédito comercial no está disponible, venció o ya fue utilizada.'},409);
          voucherGuard=' AND EXISTS(SELECT 1 FROM pos_vouchers WHERE code=? AND cents=? AND redeemed_sale IS NULL AND expires>?)';voucherBindings=[voucherOp.code,voucherOp.cents,now];
          accessWrites.push(db.prepare('UPDATE pos_vouchers SET redeemed_sale=?,redeemed_at=? WHERE code=? AND redeemed_sale IS NULL AND EXISTS(SELECT 1 FROM cedi_head WHERE id=1 AND revision=?)').bind(voucherOp.recordId,now,voucherOp.code,rev));
        }
      }

      if(authUsers!==undefined){
        const payload=authDirectoryPayload(authUsers);
        await authDirectory(db);
        accessWrites.push(db.prepare('INSERT INTO pos_auth_directory(id,payload) SELECT 1,? WHERE EXISTS(SELECT 1 FROM cedi_head WHERE id=1 AND revision=?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(payload,rev));
      }

      if(blockEmail!==undefined){
        await db.prepare('CREATE TABLE IF NOT EXISTS cedi_blocked_accounts(email TEXT PRIMARY KEY, blocked_at INTEGER NOT NULL)').run();
        accessWrites.push(db.prepare('INSERT OR IGNORE INTO cedi_blocked_accounts SELECT ?,? WHERE EXISTS(SELECT 1 FROM cedi_head WHERE id=1 AND revision=?)').bind(blockEmail.trim().toLowerCase(),Date.now(),rev));
      }
      // Both copies and the head switch run under the same D1 transaction.
      const results=await db.batch([
        db.prepare('INSERT INTO cedi_parts SELECT ?,p.part,p.payload FROM cedi_parts p WHERE p.revision=? AND p.part<? AND NOT EXISTS(SELECT 1 FROM cedi_stage s WHERE s.id=? AND s.part=p.part) AND EXISTS(SELECT 1 FROM cedi_head WHERE id=1 AND revision=?)').bind(rev,base,count,key,base),
        db.prepare('INSERT INTO cedi_parts SELECT ?,part,payload FROM cedi_stage WHERE id=? AND part<? AND EXISTS(SELECT 1 FROM cedi_head WHERE id=1 AND revision=?)').bind(rev,key,count,base),
        db.prepare('UPDATE cedi_head SET revision=?,parts=?,author=? WHERE id=1 AND revision=? AND (SELECT COUNT(*) FROM cedi_parts WHERE revision=?)=? AND (SELECT COUNT(*) FROM cedi_stage WHERE id=?)=?'+voucherGuard).bind(rev,count,email,base,rev,count,key,changes,...voucherBindings),
        db.prepare('DELETE FROM cedi_parts WHERE revision IN (?,?) AND revision<>(SELECT revision FROM cedi_head WHERE id=1)').bind(base,rev),
        db.prepare('DELETE FROM cedi_stage WHERE id=? OR created<unixepoch()-86400').bind(key),
        ...accessWrites
      ]);
      if(!results[2].meta.changes){
        const now=await db.prepare('SELECT revision FROM cedi_head WHERE id=1').first();
        if(now?.revision!==rev)return conflict();
      }
      return json({revision:rev,...(voucherOp?{voucher:voucherInfo(await readVoucher(db,voucherOp.code))}:{})});
    }catch(error){return saveError(error);}
  }
  if(url.pathname==='/api/state' && request.method==='PUT'){
    if(request.headers.get('Origin')!==url.origin||request.headers.get('Content-Type')!=='application/json')return json({},403);
    const body=await request.json();
    const {base}=body;
    // Accept complete snapshots from tabs opened before the upgrade.
    const legacy=Array.isArray(body.parts);
    const count=legacy?body.parts.length:body.count;
    const changes=legacy?body.parts.map((payload,part)=>({part,payload})):body.changes;
    if(typeof base!=='string'||!Number.isSafeInteger(count)||count<1||count>1600||!Array.isArray(changes)||changes.length>count)
      return json({error:'El tamaño o formato del guardado excede lo admitido.'},400);
    const seen=new Set();
    for(const change of changes){
      if(!change||!Number.isInteger(change.part)||change.part<0||change.part>=count||seen.has(change.part)||typeof change.payload!=='string'||!change.payload.length||change.payload.length>64000||!/^[A-Za-z0-9+/]+=*$/.test(change.payload))
        return json({error:'Se recibió un fragmento de datos inválido.'},400);
      seen.add(change.part);
    }
    const conflict=()=>json({error:'La base cambió en otra sesión. Recargá y revisá Compras registradas.'},409);
    const old=await db.prepare('SELECT revision,parts FROM cedi_head WHERE id=1').first();
    if(old?.revision!==base)return conflict();
    for(let part=old.parts;part<count;part++)if(!seen.has(part))return json({error:'Faltan datos en el guardado.'},400);
    const rev=crypto.randomUUID();
    try{
      const statements=[];
      // Copy unchanged blocks inside D1. Each bound JSON array stays below 1 MB.
      if(changes.length<count)statements.push(db.prepare('INSERT INTO cedi_parts SELECT ?,part,payload FROM cedi_parts WHERE revision=? AND part<? AND part NOT IN (SELECT value FROM json_each(?))').bind(rev,base,count,JSON.stringify([...seen])));
      for(let i=0;i<changes.length;i+=8){
        statements.push(db.prepare("INSERT INTO cedi_parts SELECT ?,json_extract(value,'$.part'),json_extract(value,'$.payload') FROM json_each(?)").bind(rev,JSON.stringify(changes.slice(i,i+8))));
      }
      statements.push(db.prepare('UPDATE cedi_head SET revision=?,parts=?,author=? WHERE id=1 AND revision=? AND (SELECT COUNT(*) FROM cedi_parts WHERE revision=?)=?').bind(rev,count,email,base,rev,count));
      const results=await db.batch(statements);
      if(!results.at(-1).meta.changes){
        await db.prepare('DELETE FROM cedi_parts WHERE revision=?').bind(rev).run();
        return conflict();
      }
    }catch(error){
      return saveError(error);
    }
    // Cleanup failure must not turn a confirmed commit into an apparent failure.
    await db.prepare('DELETE FROM cedi_parts WHERE revision=?').bind(base).run().catch(()=>{});
    return json({revision:rev});
  }
  return json({},404);
}};
