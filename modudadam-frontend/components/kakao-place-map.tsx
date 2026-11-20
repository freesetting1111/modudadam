"use client";

import { LocateFixed, MapPin, MousePointerClick, Search } from "lucide-react";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

export type KakaoPlace = { placeId:string;name:string;address:string;roadAddress:string;latitude:number;longitude:number;placeUrl:string;source?:"search"|"map" };
type KakaoLatLng={ getLat:()=>number;getLng:()=>number };
type KakaoMapInstance={ setCenter:(position:KakaoLatLng)=>void };
type KakaoMarkerInstance={ setMap:(map:KakaoMapInstance|null)=>void;setPosition:(position:KakaoLatLng)=>void;getPosition:()=>KakaoLatLng };
type KakaoPlaceResult={ id:string;place_name:string;address_name:string;road_address_name:string;x:string;y:string;place_url:string };
type KakaoAddressResult={ address_name:string;x:string;y:string;address?:{ address_name:string };road_address?:{ address_name:string;building_name?:string }|null };
type KakaoReverseAddressResult={ address:{ address_name:string };road_address?:{ address_name:string;building_name?:string }|null };
type KakaoGeocoder={ addressSearch:(address:string,callback:(result:KakaoAddressResult[],status:string)=>void)=>void;coord2Address:(lng:number,lat:number,callback:(result:KakaoReverseAddressResult[],status:string)=>void)=>void };
type KakaoMaps={
  load:(callback:()=>void)=>void;
  LatLng:new(lat:number,lng:number)=>KakaoLatLng;
  Map:new(container:HTMLElement,options:{ center:KakaoLatLng;level:number })=>KakaoMapInstance;
  Marker:new(options:{ position:KakaoLatLng;draggable?:boolean })=>KakaoMarkerInstance;
  event:{ addListener:(target:unknown,event:string,handler:(event?:{ latLng:KakaoLatLng })=>void)=>void;removeListener:(target:unknown,event:string,handler:(event?:{ latLng:KakaoLatLng })=>void)=>void };
  services:{ Status:{ OK:string };Places:new()=>{ keywordSearch:(keyword:string,callback:(result:KakaoPlaceResult[],status:string)=>void)=>void };Geocoder:new()=>KakaoGeocoder };
};
declare global { interface Window { kakao?:{ maps:KakaoMaps } } }

export function KakaoPlacePicker({ javascriptKey,value,onSelect }:{ javascriptKey:string;value:KakaoPlace|null;onSelect:(place:KakaoPlace)=>void }) {
  const mapNode=useRef<HTMLDivElement|null>(null);const mapRef=useRef<KakaoMapInstance|null>(null);const markerRef=useRef<KakaoMarkerInstance|null>(null);const geocoderRef=useRef<KakaoGeocoder|null>(null);const initialPlace=useRef(value);const onSelectRef=useRef(onSelect);
  const [ready,setReady]=useState(false);const [keyword,setKeyword]=useState(value?.name || "");const [results,setResults]=useState<KakaoPlace[]>([]);const [searching,setSearching]=useState(false);const [notice,setNotice]=useState(javascriptKey ? "" : "카카오 지도 JavaScript 키가 설정되지 않았어요.");
  useEffect(()=>{onSelectRef.current=onSelect;},[onSelect]);

  const selectMapPosition=useCallback((position:KakaoLatLng,map:KakaoMapInstance,marker:KakaoMarkerInstance)=>{
    marker.setPosition(position);marker.setMap(map);const latitude=position.getLat();const longitude=position.getLng();const geocoder=geocoderRef.current;if(!geocoder)return;setNotice("선택한 위치의 주소를 확인하고 있어요.");
    geocoder.coord2Address(longitude,latitude,(raw,status)=>{const matched=status===window.kakao?.maps.services.Status.OK ? raw[0] : null;const address=matched?.address?.address_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;const roadAddress=matched?.road_address?.address_name || "";onSelectRef.current({placeId:coordinateId(latitude,longitude),name:matched?.road_address?.building_name || roadAddress || address,address,roadAddress,latitude,longitude,placeUrl:"",source:"map"});setKeyword(roadAddress||address);setResults([]);setNotice("지도에서 선택한 위치를 적용했어요. 마커를 드래그해 다시 조정할 수 있어요.");});
  },[]);

  useEffect(()=>{
    if (!javascriptKey) return;
    let active=true;let map:KakaoMapInstance|null=null;let marker:KakaoMarkerInstance|null=null;let clickHandler:((event?:{ latLng:KakaoLatLng })=>void)|null=null;let dragHandler:(()=>void)|null=null;
    loadKakaoMaps(javascriptKey).then((maps)=>{
      if (!active || !mapNode.current) return;
      const initial=initialPlace.current;const center=new maps.LatLng(initial?.latitude || 37.5665,initial?.longitude || 126.978);
      map=new maps.Map(mapNode.current,{ center,level:initial ? 3 : 6 });marker=new maps.Marker({ position:center,draggable:true });if (initial) marker.setMap(map);
      mapRef.current=map;markerRef.current=marker;geocoderRef.current=new maps.services.Geocoder();
      clickHandler=(event)=>{ if (event?.latLng && map && marker) selectMapPosition(event.latLng,map,marker); };
      dragHandler=()=>{ if (map && marker) selectMapPosition(marker.getPosition(),map,marker); };
      maps.event.addListener(map,"click",clickHandler);maps.event.addListener(marker,"dragend",dragHandler);setReady(true);
    }).catch(()=>setNotice("카카오 지도를 불러오지 못했어요. 도메인과 JavaScript 키를 확인해 주세요."));
    return()=>{active=false;const maps=window.kakao?.maps;if(maps&&map&&clickHandler)maps.event.removeListener(map,"click",clickHandler);if(maps&&marker&&dragHandler)maps.event.removeListener(marker,"dragend",dragHandler);};
  },[javascriptKey,selectMapPosition]);

  useEffect(()=>{if(!ready||!value||!window.kakao||!mapRef.current||!markerRef.current)return;const position=new window.kakao.maps.LatLng(value.latitude,value.longitude);mapRef.current.setCenter(position);markerRef.current.setPosition(position);markerRef.current.setMap(mapRef.current);},[ready,value]);

  async function search() {const query=keyword.trim();const maps=window.kakao?.maps;if(!query||!maps)return;setSearching(true);setNotice("");const [places,addresses]=await Promise.all([searchPlaces(maps,query),searchAddresses(maps,query)]);const combined=[...places,...addresses].filter((place,index,list)=>list.findIndex((other)=>samePosition(other,place))===index).slice(0,12);setResults(combined);setNotice(combined.length ? "검색 결과에서 원하는 위치를 선택해 주세요." : "검색 결과가 없어요. 장소명이나 주소를 바꿔보세요.");setSearching(false);}
  function searchOnEnter(event:KeyboardEvent<HTMLInputElement>) {if(event.key!=="Enter")return;event.preventDefault();event.stopPropagation();void search();}
  function choose(place:KakaoPlace) {onSelect({...place,source:"search"});setKeyword(place.name);setResults([]);setNotice("검색한 위치를 적용했어요. 필요하면 지도에서 마커를 옮겨 미세 조정할 수 있어요.");}
  function useMyLocation() {navigator.geolocation?.getCurrentPosition((position)=>{const maps=window.kakao?.maps;if(!maps||!mapRef.current)return;mapRef.current.setCenter(new maps.LatLng(position.coords.latitude,position.coords.longitude));setNotice("현재 위치 주변으로 이동했어요. 지도를 누르거나 마커를 옮겨 정확한 장소를 선택해 주세요.");},()=>setNotice("현재 위치를 확인하지 못했어요."),{enableHighAccuracy:true,timeout:8000});}

  return <section className="kakao-place-picker">
    <div className="kakao-picker-methods"><strong>두 가지 방법으로 위치를 선택할 수 있어요</strong><span><Search/> 장소·주소 검색</span><i>또는</i><span><MousePointerClick/> 지도 터치·마커 이동</span></div>
    <div className="kakao-search-box"><div className="kakao-search-row"><Search/><input value={keyword} onChange={(event)=>setKeyword(event.target.value)} onKeyDown={searchOnEnter} placeholder="장소명, 도로명 또는 지번 주소"/><button type="button" disabled={!ready||searching} onClick={()=>void search()}>{searching ? "검색 중" : "검색"}</button></div></div>
    {results.length>0&&<div className="kakao-place-results">{results.map((place)=><button type="button" key={place.placeId} className={samePosition(value,place)?"selected":""} onClick={()=>choose(place)}><strong>{place.name}</strong><span>{place.roadAddress||place.address}</span><em>{place.placeUrl?"장소":"주소"}</em></button>)}</div>}
    <div className="kakao-map-toolbar"><span><MousePointerClick/> 지도를 누르거나 마커를 끌어서 선택하세요.</span><button type="button" onClick={useMyLocation}><LocateFixed/>내 주변으로 이동</button></div>
    <div ref={mapNode} className="kakao-map-canvas"/>
    {value&&<div className="kakao-place-selected"><MapPin/><span><strong>{value.name}</strong><small>{value.roadAddress||value.address}</small></span><b>{value.source==="map"||value.placeId.startsWith("coord-")?"지도 선택":"검색 선택"}</b></div>}
    {notice&&<p>{notice}</p>}
  </section>;
}

export function KakaoPlaceViewer({ javascriptKey,place }:{ javascriptKey:string;place:Pick<KakaoPlace,"name"|"latitude"|"longitude"|"placeUrl"> }) {const node=useRef<HTMLDivElement|null>(null);useEffect(()=>{let active=true;loadKakaoMaps(javascriptKey).then((maps)=>{if(!active||!node.current)return;const position=new maps.LatLng(place.latitude,place.longitude);const map=new maps.Map(node.current,{center:position,level:3});new maps.Marker({position}).setMap(map);}).catch(()=>undefined);return()=>{active=false;};},[javascriptKey,place.latitude,place.longitude]);return <div className="treasure-kakao-view"><div ref={node}/>{place.placeUrl&&<a href={place.placeUrl} target="_blank" rel="noreferrer">카카오맵에서 크게 보기</a>}</div>;}

function searchPlaces(maps:KakaoMaps,keyword:string){return new Promise<KakaoPlace[]>((resolve)=>new maps.services.Places().keywordSearch(keyword,(raw,status)=>resolve(status===maps.services.Status.OK?raw.map(toPlace):[])));}
function searchAddresses(maps:KakaoMaps,keyword:string){return new Promise<KakaoPlace[]>((resolve)=>new maps.services.Geocoder().addressSearch(keyword,(raw,status)=>resolve(status===maps.services.Status.OK?raw.map(toAddressPlace):[])));}
function toPlace(item:KakaoPlaceResult):KakaoPlace{return{placeId:item.id,name:item.place_name,address:item.address_name,roadAddress:item.road_address_name,latitude:Number(item.y),longitude:Number(item.x),placeUrl:item.place_url,source:"search"};}
function toAddressPlace(item:KakaoAddressResult):KakaoPlace{const latitude=Number(item.y);const longitude=Number(item.x);const address=item.address?.address_name||item.address_name;const roadAddress=item.road_address?.address_name||"";return{placeId:`addr-${latitude.toFixed(6)}-${longitude.toFixed(6)}`,name:item.road_address?.building_name||roadAddress||address,address,roadAddress,latitude,longitude,placeUrl:"",source:"search"};}
function coordinateId(latitude:number,longitude:number){return`coord-${latitude.toFixed(6)}-${longitude.toFixed(6)}`;}
function samePosition(left:Pick<KakaoPlace,"latitude"|"longitude">|null,right:Pick<KakaoPlace,"latitude"|"longitude">){return Boolean(left&&Math.abs(left.latitude-right.latitude)<.000001&&Math.abs(left.longitude-right.longitude)<.000001);}

let kakaoMapsPromise:Promise<KakaoMaps>|null=null;
function loadKakaoMaps(key:string){if(window.kakao?.maps)return new Promise<KakaoMaps>((resolve)=>window.kakao!.maps.load(()=>resolve(window.kakao!.maps)));if(kakaoMapsPromise)return kakaoMapsPromise;kakaoMapsPromise=new Promise((resolve,reject)=>{const existing=document.querySelector<HTMLScriptElement>('script[data-kakao-maps="true"]');const finish=()=>window.kakao?.maps.load(()=>resolve(window.kakao!.maps));if(existing){existing.addEventListener("load",finish,{once:true});existing.addEventListener("error",()=>reject(new Error("KAKAO_MAP_FAILED")),{once:true});return;}const script=document.createElement("script");script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;script.async=true;script.dataset.kakaoMaps="true";script.onload=finish;script.onerror=()=>reject(new Error("KAKAO_MAP_FAILED"));document.head.appendChild(script);});return kakaoMapsPromise;}
