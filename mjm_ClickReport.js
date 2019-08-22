//NOTES:  
//QC Tests:
//Parcel 2074300010 - No Interim Regulations. Outside all map layers.
//Parcel 4715010630 - No Interim Regulations. In M/IC, but not Heavy Industrial Use zoning.
//Parcel 0321253039 - Hits every category. 2500’ notification distance from Port M/IC. Pause on new non-industrial uses.
//Parcel 4860000310 - Heavy Industrial Use zoning.  2500’ notification distance from South Tacoma M/IC.
//Parcel 8950002121 - Heavy Industrial Use zoning outside M/IC. 2500’ notification distance from parcel. 
//Parcel 5002401340 - Marine View Drive Residential Development

define([
        "esri/symbols/SimpleLineSymbol",
        "esri/symbols/SimpleFillSymbol",
        "esri/tasks/BufferParameters",
        "esri/tasks/query",
        "esri/tasks/QueryTask",
        "esri/SpatialReference",
        "esri/tasks/GeometryService", 
        "dojo/_base/array", 
        "dijit/form/Button",
        "dojo/dom",
        "dojo/_base/Color",
        "dojo/promise/all",
            'dojo/dnd/Moveable',  //start moveable info window
            'dojo/query',
            'dojo/on',
            'dojo/dom-style',
            'dojo/dom-class'

], function (
          SimpleLineSymbol,
          SimpleFillSymbol,
          BufferParameters,
          Query, QueryTask, SpatialReference,    
          GeometryService, 
          arrayUtils, 
          Button,  
          dom,
          Color,
          all,  
            Moveable,
            dQuery,
            on,
            domStyle,
            domClass

  ) {

        //Begin Setup - put into config file eventually
        clickIdentify = true;  //Toggle to false when using other click widgets (measure) 
        var map;
        var address = ""; //Current address
        var r = "";   // Retrieving report...

        //Contact information
        var contactInfo = "<div style='clear:both;'><p><b>Questions?</b> <br>Stephen Atkinson, Planning and Development Services at (253) 591-5531 or <a href='mailto:satkinson@cityoftacoma.org?subject=Tideflats%20Interim%20Regulations'>satkinson@cityoftacoma.org</a> <br> </p></div>";  
        var closeButton = "";  //update depending on popup type (mobile vs desktop)
        var mobileSpacer = "<div style='width:100%; height:10px; padding-bottom:15px;'>&nbsp;</div>";   //blank space to cover up scrolled over text (doesn't cover 100%!!!)
        var candidate_location;  //current candidate location geometry  - location variable for both ESRI geocode and address match location
        //------------------------------------------------------------------------

        //Geometry Service - used to perform the buffer
        gsvc = new esri.tasks.GeometryService("https://gis.cityoftacoma.org/arcgis/rest/services/Utilities/Geometry/GeometryServer");

        //Current Parcel
        currentParcel="";

        //Buffer parcel parameters for additional queries
        paramsBuffer = new BufferParameters();
        paramsBuffer.distances = [ -2 ];  //inside buffer   - fix for narrow parcels like 5003642450
        paramsBuffer.bufferSpatialReference = new esri.SpatialReference({wkid: 102100});
        paramsBuffer.unit = esri.tasks.GeometryService["UNIT_FOOT"];

        //Query layer - parcel (base)
        var qtparcel = new QueryTask("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/DARTparcels_PUBLIC/MapServer/3");
        var qparcel = new Query();
        
        //Deferred Example - https://developers.arcgis.com/javascript/3/jssamples/query_deferred_list.html

        //Query layer 1 - Marine View Drive Residential Development
        var qt_1 = new QueryTask("https://services3.arcgis.com/SCwJH1pD8WSn5T5y/arcgis/rest/services/Marine_View_Drive_Residential_Development/FeatureServer/0");  
        var q_1 = new Query();

        //Query layer 2 - Port Manufacturing/Industrial Center
        var qt_2 = new QueryTask("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/DARTcommunity/MapServer/3");  
        var q_2 = new Query();
            //q_2.where = "OBJECTID = 2";

        //Query layer 3 - Heavy Industrial Uses Permitted
        var qt_3 = new QueryTask("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/DARTzoning/MapServer/14");  
        var q_3 = new Query();
            q_3.where = "(BASE_ZONE = 'PMI') OR (BASE_ZONE = 'M2') OR (BASE_ZONE = 'WR') OR (BASE_ZONE = 'S1a') OR (BASE_ZONE = 'S7') OR (BASE_ZONE = 'S8') OR (BASE_ZONE = 'S9') OR (BASE_ZONE = 'S10') OR (BASE_ZONE = 'S11')";

        //Query layer 4 - Non-Industrial Uses
        var qt_4 = new QueryTask("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/DARTlabels/MapServer/3");  
        var q_4 = new Query();
            //\\Geobase-win\CED\GADS\R2018\R004\NonIndustrialUses.mxd
            q_4.where = "(BASE_ZONE = 'PMI') OR (OBJECTID = 3732) OR (OBJECTID = 3870) OR (OBJECTID = 4032) OR (OBJECTID = 4101) OR (OBJECTID = 4318) OR (OBJECTID = 4360)";  //PMI (only occurs in Port) and M2 in Port M/IC

            //Set all common query parameters
            qparcel.returnGeometry = true;
            qparcel.outFields = q_1.outFields = q_2.outFields = q_3.outFields = q_4.outFields = ["*"];  //return all fields

        //Parcel symbol
          var symbolParcel = new SimpleFillSymbol(
            SimpleFillSymbol.STYLE_NULL,
            new SimpleLineSymbol(
              SimpleLineSymbol.STYLE_SOLID,
              new Color([255,0,0]), 
              2
            ),new Color([255,255,0,0.25])
          );
          //This sample requires a proxy page to handle communications with the ArcGIS Server services. You will need to
          //replace the url below with the location of a proxy on your machine. See the 'Using the proxy page' help topic
          //for details on setting up a proxy page.
          //esri.config.defaults.io.proxyUrl = "/website/labels/proxy.ashx";
          //esri.config.defaults.io.alwaysUseProxy = false;

        //END Setup------------------------------------------------------------------------------------------------------------------

      var mjm_ClickReportFunctions = {

       newReport: function(currentMap, mapClick, SR) {
        map = currentMap;  //update map & close button
        candidate_location = mapClick; //reset for popup window 
        paramsBuffer.outSpatialReference = SR; //Update SR 

        //Make map's infoWindow draggable/moveable if not a mobile popup -----------------------------------------
        //(https://jsfiddle.net/gavinr/cu8wL3b0/light/)

          //Determine if desktop or mobile popup being used
          if (map.infoWindow.domNode.className != "esriPopupMobile") {
            closeButton = "<div style='float:right;'><button dojoType='dijit/form/Button' type='button' onClick=\"document.getElementsByClassName('titleButton close')[0].click();\"><b>Close</b></button><br>&nbsp;</div>";
            var handle = dQuery(".title", map.infoWindow.domNode)[0];
            var dnd = new Moveable(map.infoWindow.domNode, {
                handle: handle
            });

              //When infoWindow moved, hide pointer arrow:
              on(dnd, 'FirstMove', function() {
                  // hide pointer and outerpointer (used depending on where the pointer is shown)
                  theNodes = [".outerPointer", ".pointer"];
                  arrayUtils.forEach(theNodes, function(theNode) {
                    var arrowNode =  dQuery(theNode, map.infoWindow.domNode)[0];
                       if (domStyle.get(arrowNode, "display") === "block") {
                        domStyle.set(arrowNode, "display", "none");  
                           //Reset infoWindow (put back pointer) when closed
                          var closeReset = dQuery(".titleButton.close", map.infoWindow.domNode)[0];
                            on(closeReset, 'click', function() {
                                     domStyle.set(arrowNode, "display", "");  //reset - blank will let it rebuild correctly on next open
                             }.bind(this));
                       };
                 });

              }.bind(this));
            } else {
              //Mobile popup
              closeButton = ""; //Don't use close button
              if (dQuery(".titleButton.arrow.hidden", map.infoWindow.domNode)[0] !== undefined) {
                //https://dojotoolkit.org/reference-guide/1.7/dojo/replaceClass.html
                domClass.replace(dQuery(".titleButton.arrow.hidden", map.infoWindow.domNode)[0], "", "hidden");  //Update mobile popup node class removing 'hidden'
              }
            } //end mobile popup check
       //---------------------------------------------------------------------------------------------------
        
	        if (clickIdentify){
	          //Only do if other click widgets (measure) are not being used
	          this.executeQueries(mapClick);  //need to be consistent with geocoders (sends map point)  
	        }
        },

        executeQueries: function(e) {
          this.cleanUp();
          qparcel.geometry = e;  // use the map click, geocode, or device location for the query geometry
          qtparcel.execute(qparcel, this.handleQueryParcel);  //query for a parcel at location
        },

        cleanUp: function() {
          map.graphics.clear(); //remove all graphics - buffer and points
          if (map.infoWindow.isShowing) {
           map.infoWindow.hide(); //Close existing popups
          }
        },

        handleQueryParcel: function(results) {
          currentParcel = "";  //clear out previous results
          parcel = results.features;
            //Parcel info 
            if (parcel.length>0) {
              //Parcel found - update address/parcel info
              var title = "Tacoma Tideflats Interim Regulations";
              currentParcel = parcel[0].attributes["TaxParcelNumber"];
              address = "<div><b>Address:</b>&nbsp;" + parcel[0].attributes["Site_Address"]  + "</div>"; 
                address += "<div style='clear:both;'><b>Parcel " + parcel[0].attributes["TaxParcelNumber"] + ": </b><a title='Assessor Information Link' href=\"https://epip.co.pierce.wa.us/CFApps/atr/epip/summary.cfm?parcel=" + parcel[0].attributes["TaxParcelNumber"]  + "\" target=\"_blank\">Assessor</a></div>";
                address += "<div style='clear:both;' id='messages'></div>"; //place holder id='messages'for the rest of the query info - filled in by deferred functions
              
              //Use parcel geometry for RPP query - put results into 'messages' div
              paramsBuffer.geometries = [parcel[0].geometry];
              var bufferedGeometries = gsvc.buffer(paramsBuffer);  //BUFFER the parcel
                    //Using dojo deferred 'then' function to set callback and errback functions
                    //First Deferred
                    bufferedGeometries.then(function(bufferedGeometries) {
                      
                       //Update query geometries with Parcel buffer results
                        q_1.geometry = q_2.geometry = q_3.geometry = q_4.geometry = bufferedGeometries[0];  //Query with buffer polygon - use parcel inside buffer, not map click point
                       //Deferred queries
                       DQ_1 = qt_1.execute(q_1);  //Residential [0]
                       DQ_2 = qt_2.execute(q_2);  //M/IC [1]
                       DQ_3 = qt_3.execute(q_3);  //Heavy Industrial Uses [2]
                       DQ_4 = qt_4.execute(q_4);  //Non-Industrial Uses [3]
                        //Second Deferred - Run all queries - results will be an Array - https://dojotoolkit.org/reference-guide/1.10/dojo/promise/all.html
                        all([DQ_1, DQ_2, DQ_3, DQ_4]).then(function(results){

            			  //Define function for showing/hiding regulation details
                          /*
                          function toggle_visibility(id, details) {
                            var e = document.getElementById(id);
            							  var b = document.getElementById(details);
            								e.style.display = ((e.style.display!='none') ? 'none' : 'block');
            								b.innerHTML = ((b.innerHTML!='Show Details') ? 'Show Details' : 'Hide Details');
            							}

                          */
                          var r = "";
                          //if (results[0].features.length>0 || results[1].features.length>0 || results[2].features.length>0  || results[3].features.length>0 ){
                          if (results[0].features.length>0 || results[2].features.length>0  || results[3].features.length>0 ){
                            r = "<div style='clear:both;'><hr color='#ACB1DB'></div><span style='background-color:yellow;'>This site is subject to interim use and development restrictions, per Ordinance No. 28470. <b>To Learn More Visit:</b> <a title='Tideflats Interim Regulations Information Link' href=\"https://cityoftacoma.org/tideflatsinterim\" target=\"_blank\">cityoftacoma.org/tideflatsinterim</a></span>";

                            if (results[0].features.length>0){
                              //Residential
                              r += "<div style='clear:both;'><hr color='#ACB1DB'></div><b>Marine View Drive Residential Development</b>:<br>This interim regulation pauses new residential platting and subdivision along Marine View Drive and new residential development within the S-11 Shoreline District. <br>";
                            }

                            if (results[3].features.length>0){
                              //Non-Industrial Uses
                              r += "<div style='clear:both;'><hr color='#ACB1DB'></div><b>Non-Industrial Uses</b>:<br>Pause on the establishment of new non-industrial uses within the PMI and M2 Zoning Districts in the Port of Tacoma Manufacturing and Industrial Center. <br>";
                            }

                            if (results[2].features.length>0){
                              //Heavy Industrial Uses
                              r += "<div style='clear:both;'><hr color='#ACB1DB'></div><b>Heavy Industrial Uses</b>: <br>";
                              for  (var i=0; i<results[2].features.length; i++) {  //loop thru all records (multiple zonings) - Add zoning(s) to details
                                if (i==0){
                                  r += "Parcel Zoning: " + results[2].features[i].attributes.BASE_ZONE; 
                                } else {
                                  r += "; " + results[2].features[i].attributes.BASE_ZONE;
                                } 
                              }
                              r += "<br>These interim regulations pause the establishment of the following heavy industrial uses: Coal terminals and bulk storage facilities; Oil or other liquefied fossil fuel terminals, bulk storage, manufacturing, production, processing or refining; Chemical Manufacturing; Mining and quarrying; and Smelting. These interim regulations do not apply to existing uses, which may expand under existing permit procedures and development standards.";
                            
	                            if (results[1].features.length>0){
	                              //M/IC - Expanded Notification from M/IC boundary (insert M/IC name based on size)
	                              if (results[1].features[0].attributes["SHAPE.STArea()"] < 40000000) {
	                              	MIC = "South Tacoma";
	                              } else {
	                              	MIC = "Port of Tacoma";
	                              }
	                              
	                              r += "<div style='clear:both;'><hr color='#ACB1DB'></div><b>Expanded Notification</b>:<br>Expanded public notification is required for heavy industrial projects. For this site the 2500’ notification distance is measured from the " + MIC + " Manufacturing and Industrial Center boundary. <br>";
	                            } else {
	                              r += "<div style='clear:both;'><hr color='#ACB1DB'></div><b>Expanded Notification</b>:<br>Expanded public notification is required for heavy industrial projects. For this site the 2500’ notification distance is measured from the subject parcel. <br>";
	                           }
                            }

                            r += "<div style='clear:both;'><hr color='#ACB1DB'></div>" + contactInfo + closeButton + mobileSpacer;

                          } else {
                            //None the first 3 layers are on the parcel or ... in M/IC, but not in Heavy Industrial Use zoning
                            r = "<div style='clear:both;'><hr color='#ACB1DB'></div>This site is not subject to interim use and development restrictions, per Ordinance No. 28470.<div style='clear:both;'><hr color='#ACB1DB'></div>" + contactInfo + closeButton;
                          }
                          
                          dom.byId('messages').innerHTML = r;    //update report message

                          //Check if element exists and add click event
                          /*
                            if (document.getElementById("ResidentialDetailsLink")){
                              on(document.getElementById("ResidentialDetailsLink"), 'click', function(){toggle_visibility('ResidentialDetails','ResidentialDetailsLink')}); //Add click function to Details 
                            }
                            if (document.getElementById("PortDetailsLink")){
                              on(document.getElementById("PortDetailsLink"), 'click', function(){toggle_visibility('PortDetails','PortDetailsLink')}); //Add click function to Details 
                            }
                            if (document.getElementById("HeavyDetailsLink")){
                              on(document.getElementById("HeavyDetailsLink"), 'click', function(){toggle_visibility('HeavyDetails','HeavyDetailsLink')}); //Add click function to Details 
                            }
                           */

                        }, function(err){
                          //Second Deferred Error
                          alert("Error in identify: " + err.message);
                          console.error("Identify Error: " + err.message);
                        });


                     }, function(err) {
                        //First Deferred Error
                        alert("Error retrieving parcel results: " + err.message);
                        console.error("Parcel Buffer Error: " + err.message);
                    });  

             } else {
                  //Not a parcel - REMOVE PARCEL INFO
                  var title = "Non-parcel"
                  address = "<div><i>This location is not a parcel.</i> </div><div id='messages'></div>";
                  address += "<div><i>Try clicking a nearby parcel.</i></div>" + closeButton;
                  map.setLevel(18);  //zoom to level 18 since there isn't a parcel to zoom to
            }        

             //Open info window and update content
             map.infoWindow.setTitle(title);
             var infoDiv = document.createElement("div");
              infoDiv.innerHTML = address;
              map.infoWindow.setContent(infoDiv); //add content details          

            //display the info window with the address information
            var screenPnt = map.toScreen(candidate_location);  //from map click or geocode

                map.infoWindow.show(screenPnt);  //open popup

          arrayUtils.forEach(parcel, function(feat) {
            feat.setSymbol(symbolParcel);
            map.graphics.add(feat);  // Add the parcel boundary to the map
            map.setExtent(feat._extent.expand(3.0));  //Zoom map to a multiple of parcel extent
          });

          map.centerAt(candidate_location);    //no offset

        } //last function
         
      }; //end mjm_ClickReportFunctions

  return mjm_ClickReportFunctions;  //Return an object that exposes new functions

});

