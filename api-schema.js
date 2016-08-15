var FS = require('fs');
var Path = require('path');
var XMLParser = require('xml2js').parseString;
var request = require('request');

var Schema = module.exports = {classes: {}, services: {}, enums: {}, xml: ""};
var SCHEMA_URL = "http://www.kaltura.com/api_v3/api_schema.php";
Schema.initialize = function(callback) {
  request.get(SCHEMA_URL, function(err, resp, schemaXML) {
    Schema.xml = schemaXML;
    XMLParser(schemaXML, function(err, result) {
      if (err) throw err;
      result = result.xml;
      result.services[0].service.forEach(function(service) {
        var serviceJS = Schema.services[service.$.name] = {actions: {}, id: service.$.id};
        var actions = service.action;
        actions.forEach(function(action) {
          var actionJS = serviceJS.actions[action.$.name] = {parameters: {}};
          var result = action.result[0];
          if (result) actionJS.returns = result.$.type;
          if (!action.param) return;
          action.param.forEach(function(param) {
            var paramJS = actionJS.parameters[param.$.name] = {type: param.$.type, enumType: param.$.enumType};
          });
        });
      });

      result.classes[0].class.forEach(function(cls) {
        var classJS = Schema.classes[cls.$.name] = {properties: {}};
        var props = cls.property || [];
        if (cls.$.plugin) classJS.plugin = cls.$.plugin;
        if (cls.$.abstract) {
          classJS.abstract = true;
        }
        var subclasses = result.classes[0].class
            .filter(function(subclass) {return subclass.$.base === cls.$.name})
            .map(function(subclass) {return subclass.$.name})
        if (subclasses.length) classJS.subclasses = subclasses;
        if (cls.$.base) {
          var copyBaseProps = function(baseName) {
            var baseClass = result.classes[0].class.filter(function(baseClass) {return baseName === baseClass.$.name })[0];
            if (baseClass.property) props = props.concat(baseClass.property);
            if (baseClass.$.base) copyBaseProps(baseClass.$.base);
          }
          copyBaseProps(cls.$.base);
        }
        props.forEach(function(prop) {
          var propJS = classJS.properties[prop.$.name] = {};
          propJS.type = prop.$.type;
          if (prop.$.enumType) propJS.enumType = prop.$.enumType;
        });
      });

      result.enums[0].enum.forEach(function(en) {
        var enumJS = Schema.enums[en.$.name] = {values: {}};
        if (en.$.plugin) enumJS.plugin = en.$.plugin;
        vals = en.const || []
        vals.forEach(function(val) {
          enumJS.values[val.$.name] = val.$.value;
          if (en.$.enumType === 'int') enumJS.values[val.$.name] = parseInt(enumJS.values[val.$.name]);
        })
      });
      callback();
    });
  });
}
