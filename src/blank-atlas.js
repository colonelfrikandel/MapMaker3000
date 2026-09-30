export function blankAtlas(id) {
  return {schemaVersion:1,rootBoardId:id,boards:{[id]:{id,name:'Untitled world',kind:'world',parentPlaceId:null,placeIds:[]}},places:{},routes:{},sessions:{}};
}
