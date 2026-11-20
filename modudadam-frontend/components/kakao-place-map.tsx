"use client";

import { LocateFixed, MapPin, Search } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

export type KakaoPlace = { placeId:string;name:string;address:string;roadAddress:string;latitude:number;longitude:number;placeUrl:string };

type KakaoMaps = {
  load:(callback:()=>void)=>void;
  LatLng:new(lat:number,lng:number)=>unknown;
  Map:new(container:HTMLElement,options:{center:unknown;level:number})=>{ setCenter:(position:unknown)=>void };
  Marker:new(options:{position:unknown})=>{ setMap:(map:unknown|null)=>void;setPosition:(position:unknown)=>void };
  services:{ Status:{ OK:string };Places:new()=>{ keywordSearch:(keyword:string,callback:(result:KakaoPlaceResult[],status:string)=>void)=>void } };
};
type KakaoMapInstance={ setCenter:(position:unknown)=>void };
type KakaoMarkerInstance={ setMap:(map:unknown|null)=>void;setPosition:(position:unknown)=>void };
type KakaoPlaceResult={ id:string;place_name:string;address_name:string;road_address_name:string;x:string;y:string;place_url:string };
declare global { interface Window { kakao?:{ maps:KakaoMaps } } }

export function KakaoPlacePicker({ javascriptKey,value,onSelect }:{ javascriptKey:string;value:KakaoPlace|null;onSelect:(place:KakaoPlace)=>void }) {
  const mapNode=useRef<HTMLDivElement|null>(null);const mapRef=useRef<KakaoMapInstance|null>(null);const markerRef=useRef<KakaoMarkerInstance|null>(null);const initialPlace=useRef(value);
  const [ready,setReady]=useState(false);const [keyword,setKeyword]=useState(value?.name || "");const [results,setResults]=useState<KakaoPlace[]>([]);const [notice,setNotice]=useState(javascriptKey ? "" : "카카오 지도 JavaScript 키가 설정되지 않았어요.");
  useEffect(()=>{if(!javascriptKey)return;let active=true;loadKakaoMaps(javascriptKey).then((maps)=>{if(!active||!mapNode.current)return;const initial=initialPlace.current;const center=new maps.LatLng(initial?.latitude||37.5665,initial?.longitude||126.978);const map=new maps.Map(mapNode.current,{center,level:initial?3:6});const marker=new maps.Marker({position:center});if(initial)marker.setMap(map);mapRef.current=map;markerRef.current=marker;setReady(true);}).catch(()=>setNotice("카카오 지도를 불러오지 못했어요. 도메인과 JavaScript 키를 확인해 주세요."));return()=>{active=false;};},[javascriptKey]);
  useEffect(()=>{if(!ready||!value||!window.kakao)return;showPosition(value);},[ready,value]);
  function showPosition(place:KakaoPlace){const maps=window.kakao?.maps;if(!maps||!mapRef.current||!markerRef.current)return;const position=new maps.LatLng(place.latitude,place.longitude);mapRef.current.setCenter(position);markerRef.current.setPosition(position);markerRef.current.setMap(mapRef.current);}
  function search(event:FormEvent){event.preventDefault();const query=keyword.trim();if(!query||!window.kakao)return;setNotice("");new window.kakao.maps.services.Places().keywordSearch(query,(raw,status)=>{if(status!==window.kakao?.maps.services.Status.OK){setResults([]);setNotice("검색 결과가 없어요. 장소명이나 주소를 바꿔보세요.");return;}setResults(raw.slice(0,10).map(toPlace));});}
  function choose(place:KakaoPlace){onSelect(place);setKeyword(place.name);showPosition(place);setNotice("");}
  function useMyLocation(){navigator.geolocation?.getCurrentPosition((position)=>{const maps=window.kakao?.maps;if(!maps||!mapRef.current)return;mapRef.current.setCenter(new maps.LatLng(position.coords.latitude,position.coords.longitude));setNotice("현재 위치 주변으로 지도를 이동했어요. 장소를 검색해 선택해 주세요.");},()=>setNotice("현재 위치를 확인하지 못했어요."),{enableHighAccuracy:true,timeout:8000});}
  return <section className="kakao-place-picker"><form onSubmit={search}><div><Search/><input value={keyword} onChange={(event)=>setKeyword(event.target.value)} placeholder="장소명 또는 주소 검색"/><button type="submit" disabled={!ready}>검색</button></div><button type="button" onClick={useMyLocation}><LocateFixed/>내 주변 보기</button></form><div ref={mapNode} className="kakao-map-canvas"/>{value&&<div className="kakao-place-selected"><MapPin/><span><strong>{value.name}</strong><small>{value.roadAddress||value.address}</small></span><b>선택됨</b></div>}{results.length>0&&<div className="kakao-place-results">{results.map((place)=><button type="button" key={place.placeId} className={value?.placeId===place.placeId?"selected":""} onClick={()=>choose(place)}><strong>{place.name}</strong><span>{place.roadAddress||place.address}</span></button>)}</div>}{notice&&<p>{notice}</p>}</section>;
}

export function KakaoPlaceViewer({ javascriptKey,place }:{ javascriptKey:string;place:Pick<KakaoPlace,"name"|"latitude"|"longitude"|"placeUrl"> }) {
  const node=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{let active=true;loadKakaoMaps(javascriptKey).then((maps)=>{if(!active||!node.current)return;const position=new maps.LatLng(place.latitude,place.longitude);const map=new maps.Map(node.current,{center:position,level:3});new maps.Marker({position}).setMap(map);}).catch(()=>undefined);return()=>{active=false;};},[javascriptKey,place.latitude,place.longitude]);
  return <div className="treasure-kakao-view"><div ref={node}/>{place.placeUrl&&<a href={place.placeUrl} target="_blank" rel="noreferrer">카카오맵에서 크게 보기</a>}</div>;
}

function toPlace(item:KakaoPlaceResult):KakaoPlace{return{placeId:item.id,name:item.place_name,address:item.address_name,roadAddress:item.road_address_name,latitude:Number(item.y),longitude:Number(item.x),placeUrl:item.place_url};}
let kakaoMapsPromise:Promise<KakaoMaps>|null=null;
function loadKakaoMaps(key:string){if(window.kakao?.maps)return new Promise<KakaoMaps>((resolve)=>window.kakao!.maps.load(()=>resolve(window.kakao!.maps)));if(kakaoMapsPromise)return kakaoMapsPromise;kakaoMapsPromise=new Promise((resolve,reject)=>{const existing=document.querySelector<HTMLScriptElement>('script[data-kakao-maps="true"]');const finish=()=>window.kakao?.maps.load(()=>resolve(window.kakao!.maps));if(existing){existing.addEventListener("load",finish,{once:true});existing.addEventListener("error",()=>reject(new Error("KAKAO_MAP_FAILED")),{once:true});return;}const script=document.createElement("script");script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;script.async=true;script.dataset.kakaoMaps="true";script.onload=finish;script.onerror=()=>reject(new Error("KAKAO_MAP_FAILED"));document.head.appendChild(script);});return kakaoMapsPromise;}
