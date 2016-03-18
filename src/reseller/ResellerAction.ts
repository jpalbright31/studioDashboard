import {Injectable} from "angular2/core";
import {Actions, AppStore} from "angular2-redux-util";
import {Http, Jsonp} from "angular2/http";
import {PrivelegesModel} from "./PrivelegesModel";
import {PrivelegesTemplateModel} from "./PrivelegesTemplateModel";
import {Lib} from "../Lib";
import {List} from 'immutable';
var Immutable = require('immutable');

export const RECEIVE_PRIVILEGES = 'RECEIVE_PRIVILEGES';
export const RECEIVE_PRIVILEGES_SYSTEM = 'RECEIVE_PRIVILEGES_SYSTEM';


@Injectable()
export class ResellerAction extends Actions {
    parseString;

    constructor(private appStore:AppStore, private _http:Http, private jsonp:Jsonp) {
        super(appStore);
        this.parseString = require('xml2js').parseString;
    }

    public getResellerInfo() {
        var self = this;
        return (dispatch)=> {
            var appdb:Map<string,any> = this.appStore.getState().appdb;
            var url = appdb.get('appBaseUrlUser') + `&command=GetBusinessUserInfo`;
            this._http.get(url)
                .map(result => {
                    var xmlData:string = result.text()
                    xmlData = xmlData.replace(/}\)/, '').replace(/\(\{"result":"/, '');
                    this.parseString(xmlData, {attrkey: '_attr'}, function (err, result) {

                        if (err) {
                            bootbox.alert('problem loading user info')
                            return;
                        }

                        Lib.PrivilegesXmlTemplate((err,privilegesXmlTemplate)=>{

                            /** redux inject privileges XML template system **/
                            var privilegesSystemModels = [];
                            // var tables = result.User.BusinessInfo["0"].Privileges["0"].Privilege["0"].Groups["0"].Group;
                            privilegesXmlTemplate.Privilege.Groups["0"].Group.forEach((table)=> {
                                let privelegesSystemModel:PrivelegesTemplateModel = new PrivelegesTemplateModel({
                                    tableName: table._attr.name,
                                    columns: Immutable.fromJS(table.Tables["0"]._attr)
                                });
                                if (privelegesSystemModel.getColumnSize() > 0)
                                    privilegesSystemModels.push(privelegesSystemModel)
                            })
                            dispatch(self.receivePrivilegesSystem(privilegesSystemModels));

                            /** redux inject privileges user **/
                            var privilegesModels = [];
                            result.User.BusinessInfo["0"].Privileges["0"].Privilege.forEach((privileges)=> {
                                let groups = List();
                                privileges.Groups["0"].Group.forEach((privilegesGroups)=>{
                                    var group = {
                                        tableName: privilegesGroups._attr.name,
                                        columns: Immutable.fromJS(privilegesGroups.Tables["0"]._attr)
                                    }
                                    groups = groups.push(group)
                                })
                                let privilegesModel:PrivelegesModel = new PrivelegesModel({
                                    privilegesId: privileges._attr.id,
                                    name: privileges._attr.name,
                                    groups: groups
                                });
                                privilegesModels.push(privilegesModel)
                            });
                            dispatch(self.receivePrivileges(privilegesModels));

                            // var serializedData:Array<any> = Lib.ConstructImmutableFromTable(columns)
                            // serializedData.forEach((immObj:Map<string,any>)=> {
                            // })

                        });



                    });

                }).subscribe();
        }
    }

    public receivePrivileges(privilegesModels:Array<PrivelegesModel>) {
        return {
            type: RECEIVE_PRIVILEGES,
            privilegesModels
        }
    }

    public receivePrivilegesSystem(privelegesSystemModels:Array<PrivelegesTemplateModel>) {
        return {
            type: RECEIVE_PRIVILEGES_SYSTEM,
            privelegesSystemModels
        }
    }
}
