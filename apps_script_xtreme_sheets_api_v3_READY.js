// Xtreme Sheets API v3 (compatible con tu hoja DATA)
// - POST acepta:
//   a) x-www-form-urlencoded: payload=<json>
//   b) JSON directo: { ...registro... }
//   c) Wrapper JSON: { action:"append", data:{...registro...} }
// - Escribe una fila en pestaña "DATA" usando los encabezados existentes en la fila 1
// - GET ?action=list devuelve records[] para dashboard

const SHEET_NAME = "DATA";
const TOKEN = ""; // opcional: si quieres seguridad, escribe aquí un token y envíalo desde el HTML como data.token

function _json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function _safeParse(s, fallback){
  try { return JSON.parse(s); } catch(e){ return fallback; }
}
function _getSheet(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}
function _headers(sh){
  const lastCol = Math.max(1, sh.getLastColumn());
  return sh.getRange(1,1,1,lastCol).getValues()[0].map(h => String(h||"").trim());
}
function _lk(s){ return String(s||"").trim().toLowerCase(); }

function _get(data, keys){
  for (let i=0;i<keys.length;i++){
    const k = keys[i];
    if (data[k] !== undefined) return data[k];
    const lk = _lk(k);
    if (data[lk] !== undefined) return data[lk];
  }
  return "";
}

function _valueFor(header, data){
  const H = String(header||"").trim().toUpperCase();
  if(!H) return "";

  if(H==="ID") return _get(data, ["id","ID"]) || ("R"+(new Date().getTime()));
  if(H==="FECHA") return _get(data, ["fecha","FECHA"]);
  if(H==="TURNO") return _get(data, ["turno","TURNO"]);
  if(H==="FAENA") return _get(data, ["faena","FAENA"]);
  if(H==="EQUIPOTIPO") return _get(data, ["equipoTipo","equipotipo","EQUIPOTIPO"]);
  if(H==="IDEQUIPO") return _get(data, ["idEquipo","idequipo","IDEQUIPO"]);
  if(H==="OPERADOR") return _get(data, ["operador","OPERADOR"]);
  if(H==="JEFETURNO") return _get(data, ["jefeTurno","jefeturno","JEFETURNO"]);
  if(H==="CAPATAZ") return _get(data, ["capataz","CAPATAZ"]);
  if(H==="HINI") return _get(data, ["hIni","hini","HINI","hMotorIni","horometro_ini"]);
  if(H==="HFIN") return _get(data, ["hFin","hfin","HFIN","hMotorFin","horometro_fin"]);
  if(H==="JORNADA") return _get(data, ["jornada","JORNADA"]);
  if(H==="ESTADOOPER") return _get(data, ["estadoOper","estadooper","ESTADOOPER"]);
  if(H==="COMB") return _get(data, ["comb","COMB"]);
  if(H==="ADBLUE") return _get(data, ["adblue","ADBLUE"]);
  if(H==="LIMPIEZA") return _get(data, ["limpieza","LIMPIEZA"]);
  if(H==="UBICFINAL") return _get(data, ["ubicFinal","ubicfinal","UBICFINAL"]);
  if(H==="NOVEDADES") return _get(data, ["novedades","NOVEDADES"]);
  if(H==="REMOTE_CLIENT_SENT_AT"){
    return _get(data, ["clientSentAt","remoteClientSentAt","REMOTE_CLIENT_SENT_AT"]) || new Date().toISOString();
  }
  if(H==="PAYLOAD_JSON") return JSON.stringify(data);

  return _get(data, [header, _lk(header)]);
}

function doPost(e){
  try{
    const sh = _getSheet();

    // Si no hay headers, crea los básicos
    let hdr = _headers(sh);
    if(hdr.length === 1 && hdr[0] === ""){
      hdr = [
        "ID","FECHA","TURNO","FAENA","EQUIPOTIPO","IDEQUIPO","OPERADOR","JEFETURNO","CAPATAZ",
        "HINI","HFIN","JORNADA","ESTADOOPER","COMB","ADBLUE","LIMPIEZA","UBICFINAL","NOVEDADES",
        "REMOTE_CLIENT_SENT_AT","PAYLOAD_JSON"
      ];
      sh.getRange(1,1,1,hdr.length).setValues([hdr]);
    }

    // Resolver data desde varias formas
    let data = {};
    const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : "";

    if(e && e.parameter && e.parameter.payload){
      data = _safeParse(e.parameter.payload, {});
    } else if(raw){
      const obj = _safeParse(raw, {});
      data = (obj && obj.data && typeof obj.data === "object") ? obj.data : obj;
    }

    if(TOKEN && _get(data, ["token"]) !== TOKEN){
      return _json({ok:false, error:"unauthorized"});
    }
    if(!data || Object.keys(data).length === 0){
      return _json({ok:false, error:"payload_vacio_o_no_parseado"});
    }

    if(!data.clientSentAt) data.clientSentAt = new Date().toISOString();

    const headersNow = _headers(sh);
    const row = headersNow.map(h => _valueFor(h, data));
    sh.appendRow(row);

    return _json({ok:true, inserted:true});
  }catch(err){
    return _json({ok:false, error:String(err)});
  }
}

function doGet(e){
  try{
    const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "";
    if(action !== "list"){
      return _json({ok:true, msg:"Usa ?action=list"});
    }

    const sh = _getSheet();
    const headersNow = _headers(sh);
    const lastRow = sh.getLastRow();
    if(lastRow < 2) return _json({ok:true, records:[]});

    const values = sh.getRange(2,1,lastRow-1,headersNow.length).getValues();

    const records = values.map(row => {
      const obj = {};
      for(let c=0;c<headersNow.length;c++){
        const key = _lk(headersNow[c]);
        if(!key) continue;
        obj[key] = row[c];
      }
      obj.equipoTipo = obj.equipotipo || "";
      obj.idEquipo = obj.idequipo || "";
      obj.estadoOper = obj.estadooper || "";
      obj.hMotorIni = obj.hini || "";
      obj.hMotorFin = obj.hfin || "";

      const pj = obj.payload_json;
      if(pj && typeof pj === "string"){
        const full = _safeParse(pj, null);
        if(full){
          if(full.kpiSums) obj.kpiSums = full.kpiSums;
          if(full.kpiTotals) obj.kpiTotals = full.kpiTotals;
        }
      }
      return obj;
    });

    records.sort((a,b)=>{
      const da = String(a.fecha||"");
      const db = String(b.fecha||"");
      if(da===db) return 0;
      return da < db ? 1 : -1;
    });

    return _json({ok:true, records});
  }catch(err){
    return _json({ok:false, error:String(err)});
  }
}
