import {defineStore} from "pinia";
import {ref} from "vue";

export const useConfigStore = defineStore('config',()=>{
    const data = ref('')
    const setData = (value: string) => {
        data.value = value
    }
    return {
        data,
        setData
    }
})