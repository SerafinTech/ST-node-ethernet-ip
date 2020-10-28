
/*
 * Exposed methods
 */
exports.SerialNumber = function(value, size) {
    return new SerialNumber(value, size);
};

/*
 * SerialNumber constructor
 * @public
 *
 * @param {number} value The little endian encoded number
 * @param {number} size The size of the serial number space in bits
 */
function SerialNumber(value, size) {
    if (!(this instanceof SerialNumber)) {
        return new SerialNumber(value, size);
    }

    value = typeof value !== "undefined" ? value : 0;
    size = typeof size !== "undefined" ? size : 32;

    this.serialBits = size;
    this.serialBytes = size / 8;
    this._value = value;
    this._modulo = Math.pow(2, this.serialBits);
    this._half = Math.pow(2, this.serialBits - 1);
    this._maxAdd = this._half - 1;
    this.number = this._value % this._modulo;
}

/*
 * Equality comparison with another SerialNumber
 * @public
 *
 * @param {SerialNumber} that SerialNumber to make comparison with
 * @return {boolean} comparison
 */
SerialNumber.prototype.eq = function(that) {
    return this.number === that.number;
};

/*
 * Not equal comparison with another SerialNumber
 * @public
 *
 * @param {SerialNumber} that SerialNumber to make comparison with
 * @return {boolean} comparison
 */
SerialNumber.prototype.ne = function(that) {
    return this.number !== that.number;
};

/*
 * Less than comparison with another SerialNumber
 * @public
 *
 * @param {SerialNumber} that SerialNumber to make comparison with
 * @return {boolean} comparison
 */
SerialNumber.prototype.lt = function(that) {
    return (this.number < that.number && (that.number - this.number < this._half)) ||
            (this.number > that.number && (this.number - that.number > this._half));
};

/*
 * Greater than comparison with another SerialNumber
 * @public
 *
 * @param {SerialNumber} that SerialNumber to make comparison with
 * @return {boolean} comparison
 */
SerialNumber.prototype.gt = function(that) {
    return (this.number < that.number && (that.number - this.number > this._half)) ||
            (this.number > that.number && (this.number - that.number < this._half));
};

/*
 * Less than or equal comparison with another SerialNumber
 * @public
 *
 * @param {SerialNumber} that SerialNumber to make comparison with
 * @return {boolean} comparison
 */
SerialNumber.prototype.le = function(that) {
    return this.eq(that) || this.lt(that);
};

/*
 * Greater than or equal comparison with another SerialNumber
 * @public
 *
 * @param {SerialNumber} that SerialNumber to make comparison with
 * @return {boolean} comparison
 */
SerialNumber.prototype.ge = function(that) {
    return this.eq(that) || this.gt(that);
};

/*
 * Addition operation on two SerialNumbers
 * @public
 *
 * @param {SerialNumber} that Add this SerialNumber to the receiver
 * @return {number} value of addition
 */
SerialNumber.prototype.add = function(that) {
    if (!additionOpValid.call(this, that)) {
        throw Error("Addition of this value outside [0 .. maxAdd] range");
    } else {
        this.number = (this.number + that.number) % this._modulo;
        return this.number;
    }
};

/*
 * Return the number
 * @public
 *
 * @param {object} options Optional
 *  - {string} encoding Provide 'BE' to get number as big endian
 *  - {number} radix
 *  - {boolean} string Provide false to get number as integer
 */
SerialNumber.prototype.getNumber = function(options) {
    options = typeof options !== "undefined" ? options : {};
    options.radix = options.radix ? options.radix : 10;
    options.string = options.string !== undefined ? options.string : true;

    var number = this.number.toString(options.radix);

    if (options.encoding === "BE") {
        var buf = new Buffer(this.serialBytes);
        buf.writeUIntLE(this.number, 0, this.serialBytes);
        number = buf.readUIntBE(0, this.serialBytes).toString(options.radix);
    }

    if (options.string) {
        return number;
    } else {
        console.log(number);
        return parseInt(number, options.radix);
    }
};

/*
 * Return the serial space
 * @public
 *
 * @params {boolean} bytes Return serial space as bytes instead of bits
 * @return {number} bits|bytes as integer
 */
SerialNumber.prototype.getSpace = function(bytes) {
    if (bytes) {
        return this.serialBytes;
    } else {
        return this.serialBits;
    }
};

/*
 * Override default toString method
 * @public
 */
SerialNumber.prototype.toString = function() {
    return "<number=" + this.number + ", bits=" + this.serialBits + ">";
};

/*
 * Test if addition op valid for two SerialNumbers
 * @private
 *
 * @param {SerialNumber} that Test if addition possible with receiver
 * @return {boolean} result of test
 */
function additionOpValid(that) {
    return that.number > 0 && that.number <= this._maxAdd;
}